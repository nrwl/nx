# PRD — Nx TUI keyboard input freezes on Windows once continuous tasks start

> **Status:** Revised after the reporter's diagnostics ruled out the initial
> "stdin not a TTY" hypothesis. New root cause identified by code trace and
> cross-referenced against open Nx issues #33720 and #34654.
>
> **Linked open issues:**
> - <https://github.com/nrwl/nx/issues/33720> — "Terminal UI freezes when using nx run serve" (Windows, multiple reporters)
> - <https://github.com/nrwl/nx/issues/34654> — "nx terminal freezes" (Windows, traced to a child process that reads stdin)

## Problem statement

When the Nx Terminal UI is enabled (`nx.json` → `"tui": { "enabled": true }`)
on Windows and the user runs a continuous task (`nx serve`, `npm start` →
`nx serve`, `npx nx serve` — all reproduce identically), the TUI starts up
correctly and keyboard input works **briefly** during the task-start phase
(arrow keys navigate, `Tab` switches panes). **The moment the served child
process actually begins running, the TUI becomes unresponsive** to every
key: `q`, `Esc`, `Ctrl+C`, `Ctrl+Z`, arrows, `Tab`, `?`. The only recovery
is closing the terminal window — Nx's process-tree teardown then propagates
shutdown to the dotnet and node children correctly (the reporter's
`tools/scripts/serve-api.mjs` handles `taskkill /T /F` on
`SIGINT`/`SIGBREAK`/`SIGHUP`), so port 5000 is released, but the exit path
is unacceptably blunt.

## Reproduction

| Field | Value |
|---|---|
| OS | Windows 11 Pro 10.0.26200 |
| Shell | PowerShell 7+ |
| Nx version | 22.7.2 |
| Workspace | `C:\Repos\mintplayer-ng-bootstrap` |
| `nx.json` | `"tui": { "enabled": true }`, `"useDaemonProcess": false` |
| Invocation | `npm start`, `nx serve`, and `npx nx serve` all reproduce |
| Continuous tasks | `ng-bootstrap-demo:serve` (Angular dev-server executor) and `api:serve` (`nx:run-commands` → `node tools/scripts/serve-api.mjs` → `dotnet watch`) |

Reporter's diagnostics (run 2026-05-17):

```text
PS> node -e "console.log({stdin: process.stdin.isTTY, stderr: process.stderr.isTTY})"
{ stdin: true, stderr: true }
```

Both `stdin.isTTY` and `stderr.isTTY` are `true` in the reporter's PowerShell
session — ruling out the original capability-check hypothesis.

Additional public reproductions on similar Windows configurations confirm
the symptom independent of the reporter's workspace:
- #33720 OP: nx 22.1.3, Windows, Angular serve.
- #33720 NoNamer777: nx (recent), Windows, `pnpm nx serve <app>`, multiple
  terminal hosts (Windows Terminal, VS Code integrated, Webstorm), multiple
  shells (PowerShell, cmd, Git Bash) — **all behave identically**.
- #34654 michael-golden: nx 22.6.3, Windows, Nest serve with
  `@rekog/mcp-nest`. Trigger isolated to the child app using **MCP STDIO
  transport** (`process.stdin` reads). Switching the same project to MCP SSE
  transport (no stdin reads) **makes the freeze go away**.

The MCP-STDIO datapoint is decisive — it shows the freeze is triggered by
**the child process reading from stdin**, not by anything Nx renders or any
keyboard the user presses.

## Root cause (high confidence)

**Two processes are racing for the same Windows console input stream**:
the Nx parent (running the TUI via Rust + crossterm `EventStream`, ultimately
`ReadConsoleInputW` against the parent's stdin handle) and the **forked
child task processes**, whose stdin is inherited from the parent because
Nx's PTY support is **disabled by default on Windows**.

### The decisive code path

1. **Windows ConPTY support in Nx is gated off by default** —
   `packages/nx/src/tasks-runner/pseudo-terminal.ts:245-275`
   ```ts
   function supportedPtyPlatform() {
     if (IS_WASM) return false;
     if (process.platform !== 'win32') return true;

     // TODO: Re-enable Windows support when it's stable
     // Currently, there's an issue with control chars.
     // See: https://github.com/nrwl/nx/issues/22358
     if (process.env.NX_WINDOWS_PTY_SUPPORT !== 'true') {
       return false;
     }
     // ...windows build check
   }
   ```
   So `PseudoTerminal.isSupported()` returns `false` on every Windows
   environment unless the user explicitly opts in with
   `NX_WINDOWS_PTY_SUPPORT=true`.

2. **TUI tasks fall through to the no-PTY fork path on Windows** —
   `packages/nx/src/tasks-runner/forked-process-task-runner.ts:142-188`
   ```ts
   if (
     PseudoTerminal.isSupported() &&            // false on Windows by default
     !disablePseudoTerminal &&
     (this.tuiEnabled || (streamOutput && !shouldPrefix))
   ) {
     return this.forkProcessWithPseudoTerminal(...);
   } else {
     return this.forkProcessWithPrefixAndNotTTY(...);
   }
   ```
   On Windows, the first branch is unreachable; the executor task gets
   forked through `forkProcessWithPrefixAndNotTTY`.

3. **The no-PTY fork inherits the parent's stdin** —
   `forked-process-task-runner.ts:285-291`
   ```ts
   const p = fork(this.cliPath, {
     stdio: ['inherit', 'pipe', 'pipe', 'ipc'],   // stdin = inherit
     env: { ...env, NX_FORKED_TASK_EXECUTOR: 'true' },
   });
   ```
   `inherit` for stdin means the child gets a duplicate of the **same
   Windows console input handle** the parent (Nx, with its TUI) is reading.
   The same pattern appears in `forkProcessForBatch`
   (`forked-process-task-runner.ts:70`),
   `forkProcessDirectOutputCapture` (`...:352`), and `RunningNodeProcess`
   in `run-commands` (`packages/nx/src/executors/run-commands/running-tasks.ts:421`).

4. **The TUI reads from the same stdin** —
   `packages/nx/src/native/tui/tui.rs:216-289`
   ```rust
   self.task = Some(napi::bindgen_prelude::spawn(async move {
       let mut reader = crossterm::event::EventStream::new();
       // crossterm on Windows: GetStdHandle(STD_INPUT_HANDLE) → ReadConsoleInputW
       ...
   ```
   `crossterm`'s Windows backend reads the same console-input handle the
   forked children just inherited. There is no `/dev/tty`-equivalent
   fallback on Windows.

5. **The Windows console driver routes each key event to exactly one
   reader.** When `dotnet watch`, the Angular dev-server, an MCP STDIO
   server, or any other child decides to `read(stdin)`, that child can
   intercept keystrokes destined for the TUI. The "freeze" is non-
   deterministic in principle but reliable in practice because long-running
   dev tools poll stdin continuously (`@angular/build` listens for
   `'r'`/`'u'`/`'q'`; `dotnet watch` listens for `'Ctrl+R'`; MCP STDIO
   reads JSON-RPC framed messages in a tight loop).

### Why "the TUI is initially responsive then freezes"

Children are forked asynchronously. During the brief window between the
TUI's `EventStream` starting and the first child actually beginning its
stdin read, the TUI is the only consumer, so keys work. As soon as the
child opens its stdin (typically once the dev server has finished its
startup and entered its input loop), the child becomes a competing reader
and starts winning the race for keystrokes — observed as a hard freeze.

### Why the `@rekog/mcp-nest` reproduction (#34654) was decisive

MCP STDIO transport reads from `process.stdin` in a permanent loop. With
stdin inherited, that loop guarantees the child reads every keystroke
before the TUI's `EventStream` poll can grab it. Switching transport to
SSE eliminates the child's stdin reader, removing the competition —
**confirming child-stdin-read is the trigger**.

### Why the earlier "stdin not a TTY" hypothesis was wrong

The reporter's diagnostic showed `process.stdin.isTTY === true`, and
`npx nx serve` (no npm wrapper) reproduces the bug. So neither the
JS-side capability check nor any npm-induced stdin redirection is
responsible. The capability check still has a minor correctness gap (it
inspects only `stderr.isTTY`), but **that gap does not cause this bug**
and tightening it would not fix this issue. Discarded as a fix target.

## Platform scope

- **Reproducible on Windows.** Confirmed by reporter (Nx 22.7.2,
  PowerShell, Windows 11). Reproduced by community on multiple Nx versions
  (22.1.3, 22.5.2, 22.6.3) across PowerShell / cmd / Git Bash / Windows
  Terminal / VS Code integrated / Webstorm integrated terminals.
- **Not reproducible on macOS/Linux** under normal terminals, because
  `supportedPtyPlatform()` returns `true` for non-Windows, so children
  always get their own pty endpoints and never inherit the TUI's stdin.
  (A latent risk exists if a user explicitly disables the PTY path on
  Unix, but no default Nx config does that.)
- **Workaround that confirms the hypothesis without code changes —
  CONFIRMED 2026-05-17**: setting `NX_WINDOWS_PTY_SUPPORT=true` re-enables
  ConPTY on Windows and isolates child stdin. Reporter verified that `q`,
  `Ctrl+C`, arrows, and `Tab` all respond normally with this env var set,
  on the same workspace where every key was previously dead. This
  closes the root-cause investigation: the freeze is the stdin-handle
  race, not anything in the TUI's event loop or rendering path.

## Goals

1. **Primary:** Eliminate the freeze on Windows with TUI enabled. Child
   processes spawned by Nx must not compete with the TUI for console
   input.
2. **Secondary:** Preserve the user-facing pty-supported feature set
   when re-enabling ConPTY is justified (let users actually press `i` and
   interact with their dev server through the TUI on Windows, as the
   help popup advertises at `components/help_popup.rs:176`).
3. **Tertiary:** Surface the fallback state to the user when full
   interactivity is unavailable (e.g., a one-line hint that says "TUI is
   running in non-interactive mode on this platform" so the missing `i`
   keybinding isn't a mystery).

## Non-goals

- Fixing the ConPTY control-character issue mentioned in
  `pseudo-terminal.ts:253-255` (tracked by #22358). The control-char bug
  blocked the original Windows PTY rollout; **this PRD does not require
  solving it**, only working around it for the input-routing case.
- Reworking the TUI's keybindings, countdown popup, or focus model.
- Cross-shell stdin investigations for non-Nx tools.

## Success criteria

A. Reporter runs `npm start` in `mintplayer-ng-bootstrap` on Windows with
   `tui.enabled = true` and is able to press `q` → 3-second countdown →
   another `q` → clean exit. `Ctrl+C` also works. Both child processes
   (Angular dev-server, dotnet watch) are torn down cleanly.

B. The community repros in #33720 (Angular serve) and #34654 (Nest +
   MCP-STDIO) no longer freeze.

C. No regression on macOS / Linux. The Unix-side PTY path is unchanged.

D. No regression in TUI behavior when `useDaemonProcess: true` (default
   in most Nx workspaces). The reporter has `useDaemonProcess: false`
   which keeps everything in one process — that's the worst case for
   stdin contention, but the same fix should help both topologies.

E. The fix has unit/integration coverage that asserts the chosen stdio
   mode on Windows when TUI is enabled.

F. `nx prepush` and `nx affected -t build,test,lint` against `nx` package
   pass; smoke check on a Linux box still boots the TUI normally.

## Fix strategy (two complementary options, prioritised)

### Option 1 — `stdio: 'ignore'` for child stdin when TUI is enabled (preferred for an initial fix)

**Idea:** On Windows when TUI is enabled and we know we'll be falling back
to the no-PTY path, change child stdio from `'inherit'` to `'ignore'` so
the child cannot read the parent's console input. The child still gets
`pipe`d stdout/stderr that the TUI captures and displays. The child loses
the ability to receive direct keystrokes — but on Windows it never had
real TUI-mediated interactivity anyway (no PTY = no `i` interactive mode
= no input forwarding).

**Pros:**
- Surgical, low risk. Single file, ~5 lines.
- Doesn't depend on resolving #22358's control-char issue.
- Reversible: setting `NX_WINDOWS_PTY_SUPPORT=true` continues to use the
  PTY path, gated as it is today.

**Cons:**
- The Angular dev-server's "press `r` to reload, `q` to quit" prompts
  become inert on Windows when TUI is on. Acceptable tradeoff: the TUI
  itself owns `q`-to-quit, and users who want direct dev-server stdin
  can disable the TUI per-command with `--tui=false`.
- Doesn't deliver the `i`-to-interact experience on Windows. That
  requires Option 2.

### Option 2 — Re-enable Windows ConPTY support by default (preferred for the proper fix)

**Idea:** Flip the default at `pseudo-terminal.ts:256-258`. Decouple the
Windows pty rollout from #22358 by gating only the *known broken*
control-character path while letting normal stdio go through ConPTY. If
that's infeasible, accept the residual #22358 risk as the smaller of two
evils.

**Pros:**
- Restores feature parity with macOS/Linux (interactive mode works).
- Eliminates stdin contention as a class — not just patched per call
  site.

**Cons:**
- Re-opens whichever follow-on issues motivated the gate originally.
  Note: #22358, the only issue cited in the TODO, is **closed and
  stale** (last activity on Nx 18.x; the original symptom was the
  cursor-position-query response `^[[12;1R` being echoed, a class of
  bug typically fixed by terminal libraries years ago). The Nx
  terminal stack has since changed substantially — different
  `crossterm`, ratatui 0.30, different ConPTY path via portable-pty.
  The case for the gate still being necessary is weak.
- Larger change footprint, more cross-platform verification.

### Recommendation

Land **Option 1** first as a fast, low-risk unfreeze that ships in the
next Nx patch. In parallel, **stage Option 2 as the proper fix**: since
the workaround (`NX_WINDOWS_PTY_SUPPORT=true`) has been verified to
fully resolve the freeze on a representative Windows workspace without
re-triggering #22358-class symptoms, the case for flipping the default
is stronger than the TODO suggests. Option 2 should ship within one
or two minor versions, with `NX_WINDOWS_PTY_SUPPORT=false` retained as
an escape hatch.

## Risks and trade-offs

- **Option 1 risk:** users with `npm start` workflows that depend on
  `r`/`q` prompts from the underlying dev-server will lose those when
  TUI is on. Mitigation: `nx serve --tui=false` already disables the
  TUI per-command, and the user can also set `NX_WINDOWS_PTY_SUPPORT=true`
  to take Option 2's path explicitly.
- **Option 2 risk:** #22358's control-char issue may resurface for some
  users. Mitigation: keep the env-var override (`NX_WINDOWS_PTY_SUPPORT=false`)
  as an escape hatch so users hitting it can revert without downgrading.
- **Both options' risk:** changing stdio modes may interact with Nx
  Cloud's task forwarding or with the daemon's IPC. The `'ipc'` slot is
  preserved by both options; verify with existing daemon tests.

## Related Nx code locations

| Concern | File:line |
|---|---|
| Windows PTY gate (root cause) | `packages/nx/src/tasks-runner/pseudo-terminal.ts:245-275` |
| Executor fork path with stdin inherit | `packages/nx/src/tasks-runner/forked-process-task-runner.ts:142-188`, `:265-330` |
| Batch fork path with stdin inherit | `packages/nx/src/tasks-runner/forked-process-task-runner.ts:49-110` (line 70 has `stdio`) |
| Direct-output fork with stdin inherit | `packages/nx/src/tasks-runner/forked-process-task-runner.ts:332-380` (line 352 has `stdio`) |
| `nx:run-commands` non-PTY fallback | `packages/nx/src/executors/run-commands/running-tasks.ts:383-422` (line 421 has `stdio`) |
| TUI event reader (the loser of the race) | `packages/nx/src/native/tui/tui.rs:202-289` |
| Stdin TTY helper (unrelated to this bug) | `packages/nx/src/native/tui/tui.rs:134-145` |
| Windows-specific PTY writer | `packages/nx/src/native/pseudo_terminal/command/windows.rs:28-33` |
| Open public issue (Angular serve) | #33720 — <https://github.com/nrwl/nx/issues/33720> |
| Open public issue (MCP-STDIO repro) | #34654 — <https://github.com/nrwl/nx/issues/34654> |
| Blocker issue cited in the TODO | #22358 — <https://github.com/nrwl/nx/issues/22358> |

## Diagnostic confirmation — completed 2026-05-17

```powershell
cd C:\Repos\mintplayer-ng-bootstrap
$env:NX_WINDOWS_PTY_SUPPORT = 'true'; npm start
```

Result: **freeze eliminated.** `q`, `Ctrl+C`, arrows, and `Tab` all
respond normally. Root cause analysis confirmed; Option 1 and Option 2
remain the appropriate fix directions.

Public confirmation was posted to nrwl/nx#33720 on 2026-05-17:
<https://github.com/nrwl/nx/issues/33720#issuecomment-4470247204>.

## Workaround for the reporter (while a fix lands)

Edit `C:\Repos\mintplayer-ng-bootstrap\nx.json`:

```jsonc
{
  // ...
  "tui": { "enabled": false }
}
```

Or per-invocation: `nx serve --tui=false`. This costs the TUI's nice
multi-pane view but restores normal `Ctrl+C` behavior immediately.
