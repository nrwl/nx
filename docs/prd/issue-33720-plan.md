# Implementation plan — fix the Windows TUI input freeze

Companion to `nx-tui-input-unresponsive-PRD.md`. This plan lands the
**Option 1** fix (don't inherit stdin into child tasks when the TUI is
enabled on Windows) and stages the **Option 2** follow-up (re-enable
ConPTY by default).

## Strategy in one paragraph

The freeze on Windows is caused by Nx forking child tasks with
`stdio: ['inherit', ...]`, which gives them a duplicate of the parent's
console-input handle. The Rust TUI (crossterm `EventStream`) reads the
same handle, and Windows routes each keystroke to whichever process is
actively reading — so once any child reads stdin (Angular dev-server,
dotnet watch, MCP STDIO server), it starves the TUI of keys. On
macOS/Linux this doesn't happen because Nx already routes each child
through its own pty; on Windows that path is disabled by default
(`supportedPtyPlatform()` returns false). The fix swaps `stdin: 'inherit'`
for `stdin: 'ignore'` in the four Windows non-PTY fork sites whenever
TUI is enabled. This makes child processes unable to read the console,
isolating the TUI's input. Then we ship a Vitest covering the stdio mode
selection on Windows, verify against the reporter's repro and the public
repros in #33720/#34654, and run the standard `prepush` / `affected`
gate. The Option 2 follow-up (re-enable ConPTY by default) is filed as a
separate issue with #22358 as the explicit blocker to revisit.

## Pre-flight — DONE 2026-05-17

```powershell
cd C:\Repos\mintplayer-ng-bootstrap
$env:NX_WINDOWS_PTY_SUPPORT = 'true'; npm start
```

Result: **freeze eliminated.** `q`, `Ctrl+C`, arrows, and `Tab` all
respond normally. Root cause (stdin-handle race) confirmed. Plan
proceeds as written.

Public confirmation: <https://github.com/nrwl/nx/issues/33720#issuecomment-4470247204>.

## Step-by-step (Option 1 — surgical fix)

### Step 1 — Identify the four sites that need the stdio swap

All four spawn children with `stdio: ['inherit', ...]`. On Windows when
TUI is enabled, the inherit must become `'ignore'`.

| Site | File:line | Spawned by |
|---|---|---|
| Batch fork | `packages/nx/src/tasks-runner/forked-process-task-runner.ts:70` | `forkProcessForBatch` |
| Standard fork (no PTY) | `packages/nx/src/tasks-runner/forked-process-task-runner.ts:286` | `forkProcessWithPrefixAndNotTTY` (the path Windows lands in by default) |
| Direct-output fork | `packages/nx/src/tasks-runner/forked-process-task-runner.ts:352` | `forkProcessDirectOutputCapture` |
| `nx:run-commands` non-PTY spawn | `packages/nx/src/executors/run-commands/running-tasks.ts:421` | `RunningNodeProcess` constructor |

### Step 2 — Add a helper that picks the right stdin mode

Centralise the decision so each site is a one-line change and the test
matrix has a single seam.

**Create** `packages/nx/src/tasks-runner/child-stdin-mode.ts` (~15 lines):

```ts
import type { StdioOptions } from 'child_process';

/**
 * Decide whether a forked task child should inherit the parent's stdin.
 *
 * When the TUI is enabled on Windows, inheriting stdin lets the child
 * race the TUI's crossterm EventStream for keystrokes (see
 * docs/prd/nx-tui-input-unresponsive-PRD.md). 'ignore' isolates the TUI's
 * input at the cost of losing the child's own stdin-driven prompts —
 * acceptable because no TUI-mediated input path exists on Windows
 * without ConPTY anyway.
 */
export function childStdinMode(opts: {
  tuiEnabled: boolean;
}): 'inherit' | 'ignore' {
  if (opts.tuiEnabled && process.platform === 'win32') {
    return 'ignore';
  }
  return 'inherit';
}
```

### Step 3 — Apply the helper at each site

For each of the four spawn calls, replace `'inherit'` in the `stdio`
array's index 0 with `childStdinMode({ tuiEnabled: this.tuiEnabled })`.
Example for `forked-process-task-runner.ts:286`:

```ts
// before
const p = fork(this.cliPath, {
  stdio: ['inherit', 'pipe', 'pipe', 'ipc'],
  env: { ...env, NX_FORKED_TASK_EXECUTOR: 'true' },
});

// after
const p = fork(this.cliPath, {
  stdio: [
    childStdinMode({ tuiEnabled: this.tuiEnabled }),
    'pipe',
    'pipe',
    'ipc',
  ],
  env: { ...env, NX_FORKED_TASK_EXECUTOR: 'true' },
});
```

For `running-tasks.ts:421` (`RunningNodeProcess`), the class needs the
`tuiEnabled` value. It's reachable via `isTuiEnabled()` from
`tasks-runner/is-tui-enabled.ts`:

```ts
import { isTuiEnabled } from '../../tasks-runner/is-tui-enabled';

// ...inside the constructor:
this.childProcess = spawn(commandConfig.command, [], {
  shell: true,
  detached: process.platform !== 'win32',
  env,
  cwd,
  windowsHide: true,
  stdio: [
    childStdinMode({ tuiEnabled: isTuiEnabled() }),
    'pipe',
    'pipe',
  ],
});
```

`isTuiEnabled()` reads `process.env.NX_TUI === 'true'`, which is
authoritative at fork time (the task-runner sets it before spawning
children).

### Step 4 — Tests

**Create** `packages/nx/src/tasks-runner/child-stdin-mode.spec.ts`:

```ts
import { childStdinMode } from './child-stdin-mode';

describe('childStdinMode', () => {
  const originalPlatform = process.platform;

  function withPlatform(plat: NodeJS.Platform, fn: () => void) {
    Object.defineProperty(process, 'platform', { value: plat });
    try { fn(); } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  }

  it('inherits stdin on Linux regardless of TUI state', () => {
    withPlatform('linux', () => {
      expect(childStdinMode({ tuiEnabled: false })).toBe('inherit');
      expect(childStdinMode({ tuiEnabled: true })).toBe('inherit');
    });
  });

  it('inherits stdin on macOS regardless of TUI state', () => {
    withPlatform('darwin', () => {
      expect(childStdinMode({ tuiEnabled: false })).toBe('inherit');
      expect(childStdinMode({ tuiEnabled: true })).toBe('inherit');
    });
  });

  it('inherits stdin on Windows when TUI is off', () => {
    withPlatform('win32', () => {
      expect(childStdinMode({ tuiEnabled: false })).toBe('inherit');
    });
  });

  it('ignores stdin on Windows when TUI is on', () => {
    withPlatform('win32', () => {
      expect(childStdinMode({ tuiEnabled: true })).toBe('ignore');
    });
  });
});
```

No native rebuild needed for this step — the change is pure JS.

### Step 5 — Verify against the reporter's repro

Link the patched Nx into `C:\Repos\mintplayer-ng-bootstrap`
(`pnpm link` / `npm link` / `nx-cli local-registry` depending on the
team's usual workflow — confirm with reporter), then:

```powershell
cd C:\Repos\mintplayer-ng-bootstrap
npm start           # should now respond to q / Ctrl+C
$env:NX_TUI = 'false'; npm start   # still works (sanity)
nx serve --tui=false               # still works (sanity)
```

Manually exercise:

1. Wait for both task panes to render.
2. Press `q`. Expect 3-second countdown popup. Press `q` again.
3. Expect clean exit. Verify port 5000 is released (`netstat -ano | findstr :5000`).
4. Repeat with `Ctrl+C` instead of `q`. Same expected outcome.
5. Repeat with `Tab` and arrow keys before quitting — confirm navigation works.

### Step 6 — Verify against the public repros

Clone the reproducers from #34654's comment thread and confirm they no
longer freeze:

```powershell
cd $env:TEMP
git clone https://github.com/michael-golden/tui
cd tui
npm install
npx nx serve <whatever the README says>
```

Same manual checks as Step 5.

### Step 7 — Validation suite

Per `CLAUDE.md`:

```bash
nx run-many -t test,build,lint -p nx
nx affected -t build,test,lint
nx affected -t e2e-local
```

If any failure surfaces, fix and amend the commit (do not stack a
fix-up commit, per CLAUDE.md).

### Step 8 — Cross-platform smoke check

On a macOS or Linux machine (or via WSL), run a small Nx workspace's
`nx serve`. Confirm:

- TUI still launches.
- `q` and `Ctrl+C` still respond.
- Interactive mode (`i`) still forwards keystrokes to the focused
  task's pty.

This is the regression gate on the Unix-side codepath.

### Step 9 — Commit & PR

Conventional commit (scope `core` per `scripts/commitizen.js`):

```
fix(core): don't inherit stdin into child tasks when TUI is enabled on Windows

When the Nx TUI is enabled on Windows, forked task children inherited
the parent's console stdin (because PseudoTerminal.isSupported() returns
false on Windows by default, so the no-PTY fork path is taken). The
Rust TUI reads the same console handle via crossterm's EventStream, so
once any child started reading stdin (Angular dev-server's r/q/u
prompts, dotnet watch's ctrl+r, MCP STDIO servers) it starved the TUI
of keystrokes — observed as the TUI becoming completely unresponsive
to q, Ctrl+C, Esc, and arrow keys once the served process started up.

Switch stdin from 'inherit' to 'ignore' for fork-task children on
Windows when the TUI is enabled. Macroscopic effect: child processes
can no longer read direct keystrokes from the console. They never had
TUI-mediated interactivity on Windows anyway (no PTY → no `i`
forwarding), so this is a non-regression for the supported feature
set. Users who specifically want the child's stdin (e.g., dev-server's
`r` reload prompt) can opt out per-command with --tui=false or
globally with `"tui": { "enabled": false }` in nx.json.

Re-enabling Windows ConPTY by default (which would also fix this and
restore interactive mode) is staged as a follow-up gated on #22358.

Fixes #33720
Refs   #34654
```

PR template per `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Current Behavior
On Windows, when the Nx TUI is enabled, child task processes inherit
the parent's console stdin. The Rust TUI reads the same console
handle, so any child that reads stdin (most dev servers, dotnet watch,
MCP STDIO servers) starves the TUI of keystrokes once it starts. The
TUI becomes unresponsive to q, Ctrl+C, Esc, and arrow keys.

## Expected Behavior
Child tasks no longer receive the parent's stdin when the TUI is
enabled on Windows. The TUI exclusively owns console input and
responds normally to q (countdown → exit), Ctrl+C (immediate exit),
and navigation keys.

## Related Issue(s)
Fixes #33720
Refs   #34654
```

## Stretch: Option 2 — re-enable Windows ConPTY by default (follow-up)

Tracked separately because it requires fresh evaluation of #22358's
control-character bug, which was the original reason ConPTY was gated
off on Windows.

Outline (do NOT do in this PR):

1. Reproduce #22358 against current main on Windows. Determine whether
   the control-char issue is still present in `portable-pty` /
   `crossterm-rs` versions Nx now uses.
2. If gone: flip the default at `pseudo-terminal.ts:256-258` and keep
   the env-var override (`NX_WINDOWS_PTY_SUPPORT=false`) as an escape
   hatch.
3. If still present: investigate whether the bug can be quarantined to
   specific input sequences rather than gating all of Windows.
4. Add a Windows e2e covering TUI interactive mode (`i` → key forwarding
   → `Ctrl+Z` to exit) to prevent regressions.

## Open questions to resolve before merge

1. **Does ignoring stdin break the daemon's IPC?** The fork already uses
   `'ipc'` for the fourth stdio slot — that's a separate channel and
   should not be affected. Verify with the daemon e2e tests in Step 7.
2. **Should `running-tasks.ts:421`'s `RunningNodeProcess` also get the
   stdio swap?** Yes — it spawns the user's command (e.g., the
   reporter's `node tools/scripts/serve-api.mjs`) and uses
   `'inherit'` for stdin. Step 3 covers it.
3. **Is `process.env.NX_TUI === 'true'` set at the time
   `RunningNodeProcess` runs?** Confirm by tracing where the task runner
   sets `NX_TUI` for forked children. If timing is wrong, pass
   `tuiEnabled` through the executor options instead of reading from
   env.
4. **Pretest with the reporter:** the pre-flight diagnostic
   (`NX_WINDOWS_PTY_SUPPORT=true`) must confirm no freeze before the
   patch is merged. Do not merge without that signal.

## Estimated effort

- Step 2–3 (helper + four sites): ~1 h.
- Step 4 (Vitest): ~30 min.
- Step 5–6 (manual verification): ~1 h.
- Step 7–8 (prepush + Unix smoke): ~1 h.
- Step 9 (PR + review): ~30 min review-back-and-forth.
- **Total: ~half a day** for Option 1.
- Option 2 follow-up: 1–3 days depending on #22358 evaluation.

## Rollback plan

The change is one helper + four one-line call sites. To rollback, revert
the patch — child stdio reverts to `'inherit'`, restoring pre-fix
behavior. No data migration, no env-var coupling beyond what was
already present (`NX_WINDOWS_PTY_SUPPORT`).
