---
name: vitest-migration
description: Migrate an Nx repo package's unit tests from Jest to Vitest, reusing the shared setup that packages/workspace established. Use when asked to "move <pkg> to vitest", "migrate <pkg> tests off jest", or "run <pkg> unit tests with vitest".
allowed-tools: Read, Glob, Grep, Agent, Edit(*), Write(*), Bash(pnpm nx *), Bash(npx nx *), Bash(nx *), Bash(git *), Bash(ls *), Bash(cat *), Bash(head *), Bash(tail *), Bash(sed *), Bash(grep *), Bash(rg *), Bash(find *), Bash(wc *), Bash(echo *), Bash(mkdir *), Bash(rm *), Bash(mv *), Bash(node *), Bash(npx oxfmt *), Bash(gh pr view *), Bash(gh pr diff *)
---

# Migrate a package's unit tests to Vitest

Move `packages/<name>`'s unit tests from Jest to Vitest 4, inferred through the
`@nx/vitest` plugin.

**Start from `packages/workspace`, not `packages/nx`.** The shared machinery a
sibling package needs already exists — read these first and reuse them as-is:

- `scripts/vitest-setup.mts` — the port of `scripts/unit-test-setup.js`; every
  migrated package loads it as its `setupFiles`
- `scripts/vitest-nx-source-resolver.mts` — resolves `nx` / `@nx/*` to this
  repo's source, for both vite and node
- `packages/workspace/vitest.config.mts` — the config those two plug into
- `packages/workspace/project.json` — `test.inputs` naming the shared scripts

`packages/nx` (PR #36754, commit `32dd3fb533`) is the _original_ migration but a
poor template: it is the one package that imports almost no siblings, so it
needs neither the source resolver nor the CJS-channel mocks. Consult it only for
`vitest-write-guard.cjs` and `src/internal-testing-utils/cjs-mock.ts`.
`packages/angular-rspack/vitest.config.mts` is the simple end of the spectrum
(no nx source at all).

## Argument

The package name (e.g. `js`, `devkit`, `workspace`). The package lives at
`packages/<name>/`.

## Why this is not a find-and-replace

Jest and Vitest disagree on module semantics, not just API names. The
mechanical `jest.*` → `vi.*` rename is maybe 80% of the diff and 20% of the
work. The rest is: which _channel_ a mock reaches (ESM graph vs CJS
`require()`), whether a namespace is frozen, and what `resetAllMocks` does to a
spy. Budget for hand-fixing specs after the codemod.

---

## Step 0 — Survey the package

Run these and write the answers into `tmp/notes/vitest-migration-<name>.md`
before touching anything:

```bash
ls packages/<name>/jest.config.cts packages/<name>/jest*.js 2>/dev/null
cat packages/<name>/jest.config.cts
cat packages/<name>/tsconfig.spec.json
grep -rl "\.spec\.ts" -c packages/<name>/src | wc -l   # rough spec count
pnpm nx show project <name> --json | head -40
```

Capture:

1. **Spec count and current runtime.** Run `pnpm nx test <name> --skip-nx-cache`
   once and record the reported test count and wall time. That number is the
   parity target in Step 6 — you cannot verify the migration without it.
2. **Jest config specials** — anything beyond `displayName`/`preset`/
   `moduleFileExtensions` is behavior you must reproduce:
   - `setupFiles` (e.g. `packages/devkit/jest-setup-nx-workspace-data-dir.js`)
   - `moduleNameMapper` (path shims; also `identity-obj-proxy` for CSS)
   - `testEnvironment: 'jsdom'` → needs `environment: 'jsdom'` and the
     `jsdom` dep
   - `modulePathIgnorePatterns` / `testPathIgnorePatterns` → `exclude`
   - `resolver` → `resolve.conditions` (see Step 2)
3. **Inherited preset behavior** (`jest.preset.js`) that Vitest does _not_ get
   for free:
   - `setupFiles: ['../../scripts/unit-test-setup.js']` — the workspace-wide
     project-graph / workspace-context / native guards. **This must be ported**
     (Step 3).
   - `resolver: '../../scripts/patched-jest-resolver.js'` — maps `@nx/*` and
     `nx/*` onto `packages/*` source, **and** sets
     `NX_WORKSPACE_ROOT_PATH=<repo>/tmp/unit` as a side effect. Both are
     reproduced by the shared scripts (Steps 2 and 3).
   - `moduleNameMapper` ESM shims (`@clack/prompts`, `ora`, `chalk`,
     `yargs-parser`, `prettier`, `magic-string`, `oxfmt`). Most are pure ESM
     interop Vitest does not need — but check each for _behavior_ before
     dropping it. `@clack/prompts` is load-bearing: the stub answers `undefined`
     where the real library drives a **synchronous** prompt, and a generator
     that asks a question blocks the worker forever with no test timeout.
     `scripts/vitest-setup.mts` already keeps that one. `prettier`'s stub also
     pins `resolveConfig: () => null`, which matters if the package snapshots
     formatted output.
   - `maxWorkers: 1` — Vitest runs files in parallel. Any spec relying on
     cross-file ordering or a shared mutable temp dir will now fail. This is
     the main source of "it passed under jest" flakes.
4. **Native bindings** — does the package load `nx/src/native` or a `.node`
   file? If yes you need `pool: 'forks'` and the native shim plugin from
   `packages/nx/vitest.config.mts`.
5. **Lazy `require()` of TS source** — `grep -rn "require(" packages/<name>/src
--include=*.ts | grep -v "^.*spec"`. Every bare `require()` of a local `.ts`
   file needs `@swc-node/register` (Step 2) and can only be mocked through
   `mockCjsModule` (Step 4).

---

## Step 1 — Target inference

`@nx/vitest` is already registered in `nx.json` for `packages/**/*`, so a
`vitest.config.mts` at the package root is enough to infer `<name>:test`.
Verify the plugin block still reads:

```json
{
  "plugin": "@nx/vitest",
  "options": { "testTargetName": "test" },
  "include": ["packages/**/*"],
  "exclude": ["**/out-tsc/**"]
}
```

`@nx/jest` infers `test` from `jest.config.*` presence. **Both plugins would
claim `test`**, so `jest.config.cts` must be deleted in the same change, not
left behind "just in case". Also delete any `jest-resolver.js` and drop
`project.json` target overrides that reference jest inputs (see the
`packages/nx` diff — a `"test": { "inputs": [..., "patched-jest-resolver.js"] }`
block was removed).

---

## Step 2 — Write `packages/<name>/vitest.config.mts`

Start from `packages/nx/vitest.config.mts` and keep only what the survey
justified. The load-bearing pieces and why:

```ts
export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/<name>/unit',
  test: {
    watch: false,
    globals: true, // specs use bare describe/it/expect/vi
    environment: 'node', // or 'jsdom' if the jest config said so
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['./vitest.setup.mts'],
    testTimeout: 35000, // matches jest.preset.js
    pool: 'forks', // ONLY if native .node bindings are loaded;
    // they are not thread-safe across workers
    teardownTimeout: 60_000, // specs holding native contexts exit slowly;
    // the jest setup hid this behind --forceExit
    execArgv: ['--conditions=@nx/nx-source'],
    server: { deps: { external: [/\.node$/] } },
  },
  resolve: {
    conditions: ['@nx/nx-source'],
  },
  plugins: [nxSourceResolver()], // scripts/vitest-nx-source-resolver.mts
});
```

Rules for resolution — the part that most looks solved and isn't:

- **`conditions: ['@nx/nx-source']` does NOT replace the jest resolver.**
  `node_modules/nx` and `node_modules/@nx/*` are the _published_ tarballs (dist
  only, no source), and their exports maps advertise `@nx/nx-source` entries
  pointing at `./src/index.ts` files the tarball does not ship — so the
  condition resolves to a file that isn't there. Use `nxSourceResolver()` from
  `scripts/vitest-nx-source-resolver.mts`, which maps `nx` / `@nx/*` through
  the _local_ `packages/<pkg>/package.json`, with a file fallback for deep
  imports no exports entry covers (`@nx/workspace/src/...`).
- **`execArgv: ['--conditions=@nx/nx-source']` on its own actively breaks node
  resolution**, for the same reason: a lazy `require('@nx/js')` dies with
  `Cannot find module '.../node_modules/@nx/js/src/index.ts'`. Keep the flag,
  but `scripts/vitest-setup.mts` must also patch `Module._resolveFilename`
  with the same mapping so both channels agree.
- **Aliases use regex, not strings.** Vite string aliases do prefix matching,
  so `'@nx/devkit'` would rewrite `@nx/devkit/internal` too. Use
  `{ find: /^@nx\/devkit$/, replacement: ... }`.
- `packages/nx` predates the shared resolver and hard-codes `nx/src/*` and
  `nx/bin/*` aliases instead. Don't copy that — the resolver covers it.
- If the package imports `yargs` with CJS-namespace style
  (`yargs.terminalWidth()`), alias it to `node_modules/yargs/index.cjs`.
- If the package loads `nx/src/native`, copy the `nx-native-shim` plugin
  verbatim — `src/native/index.js` requires TS files and cannot run outside a
  transform, so it must be routed to the generated `native-bindings.js` and
  externalized.

---

## Step 3 — Wire up the shared setup

Point the config at the shared file; do not write a per-package copy:

```ts
setupFiles: ['../../scripts/vitest-setup.mts'],
```

`scripts/vitest-setup.mts` is the port of `scripts/unit-test-setup.js` (which
is jest-only — `jest.doMock` — so it can never be imported from vitest). Read
it before assuming anything is missing; it already does all of the following,
and each line is there because its absence broke `packages/workspace`:

- `NX_DAEMON=false`, `npm_config_user_agent` deleted, `FORCE_COLOR` deleted and
  `NO_COLOR=1` (snapshots are recorded colorless).
- `NX_WORKSPACE_ROOT_PATH` under `tmp/unit/<pid>` — **per worker process**,
  unlike jest. The jest resolver set a single `tmp/unit` as a side effect;
  with vitest's parallel workers one shared root makes every worker queue on
  the same lock ("Waiting for graph construction in another process to
  complete", 35s timeouts).
- `NX_ISOLATE_PLUGINS=false`. Otherwise plugin isolation spawns a worker
  subprocess per plugin that is never torn down, and the spec file stalls to
  its timeout. Two `packages/nx` specs already carry this same note.
- `@swc-node/register`, with `Error.prepareStackTrace` **restored immediately
  after**: the hook installs source-map-support, which mis-maps
  vite-transformed frames and breaks error locations _and_ inline-snapshot
  updates.
- `Module._resolveFilename` patched with the source mapping (Step 2), plus
  `@clack/prompts` → `scripts/jest-mocks/clack-prompts.js`.
- `vi.doMock` graph/workspace-context/native guards, keyed by **absolute
  physical path** — mocking the `nx/src/...` specifier routes through the pnpm
  symlink and keys as a different module, so the mock silently never applies.
- **The same graph mocks again, on the CJS channel**, via a `Module._load`
  patch. This is the one most easily missed and the most expensive to debug:
  generators reach graph builders through lazy `require()`, which `vi.mock`
  cannot see, and the unmocked `createProjectGraphAsync` takes
  `project-graph.lock` and **deadlocks the worker** — no output, and no test
  timeout fires, because the main thread is blocked in a futex.
- Pass-through helpers are plain functions, not `vi.fn()`, so a suite's
  `vi.resetAllMocks()` cannot wipe them into `() => undefined`.

Add to the shared file (not a package-local one) if the package needs a guard
nothing else does, and say so in the PR — every migrated package loads it.

Two more rules:

1. **Do not alias a `jest` global in the setup.** A stray `jest.mock` would not
   be hoisted by vitest's transform and would silently fail to intercept. Let
   it throw.
2. If the package's specs can write repo files, copy
   `packages/nx/vitest-write-guard.cjs` and load it through
   `execArgv: ['--require', ...]`. It must be `execArgv`, not `setupFiles`:
   node snapshots a module's ESM named exports on first import, so a patch
   applied from a setup file is invisible to `import { writeFile } from 'fs'`.
   (The `packages/nx` migration found a spec that had been overwriting the
   repo's real `nx.json`.)

Finally, name the shared files in the package's `project.json` so the cache
sees them — they live outside `{projectRoot}`, so nothing else invalidates on
an edit:

```json
"test": {
  "inputs": [
    "...",
    "{workspaceRoot}/scripts/vitest-setup.mts",
    "{workspaceRoot}/scripts/vitest-nx-source-resolver.mts",
    "{workspaceRoot}/scripts/jest-mocks/clack-prompts.js"
  ]
}
```

---

## Step 4 — `tsconfig.spec.json`

```jsonc
{
  "compilerOptions": {
    "types": ["vitest/globals", "node"], // was ["jest", "node"]
  },
  "include": [
    // ...
    "vitest.config.mts", // replaces "jest.config.ts"
    "vitest.setup.mts",
  ],
}
```

Drop `@types/jest` from the package's `devDependencies` only if no other
project in the repo still needs it there.

---

## Step 5 — Codemod the specs

Apply mechanically, then hand-fix. Prefer one script over 200 manual edits, and
commit the codemod pass separately from the hand fixes so review can follow.

Two rules before you run anything:

- **Never codemod the whole package blindly.** Some files contain `jest.*` in
  _strings_, not calls — a spec for a codemod that rewrites `jest.mock(...)`
  text, generator specs asserting on `jest.config.cts` contents, or
  `'@nx/jest:jest'` executor names. Build the file list from a grep for real
  API usage (`grep -l 'jest\.[a-z]' | grep -v` the string-only ones) and
  eyeball it.
- **Match across newlines.** `jest\n  .fn()` and `jest\n  .spyOn(...)` are
  common in this repo and a line-based `s/jest\.fn(/vi.fn(/` silently misses
  them, leaving `ReferenceError: jest is not defined` at collection. Use
  `perl -0p` (or equivalent) and re-grep for a bare `\bjest\b` afterwards.

| Jest                                                                                                                                                         | Vitest                                           | Note                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `jest.fn` / `jest.spyOn` / `jest.mock` / `jest.doMock` / `jest.unmock` / `jest.clearAllMocks` / `jest.restoreAllMocks` / `jest.resetModules` / `jest.mocked` | same with `vi.`                                  | pure rename                                                                                |
| `jest.requireActual<T>(x)`                                                                                                                                   | `await vi.importActual<T>(x)`                    | factory must become `async`                                                                |
| `jest.requireMock(x)`                                                                                                                                        | `await vi.importMock(x)`                         | factory must become `async`                                                                |
| `jest.isolateModules(() => { require(x) })`                                                                                                                  | `vi.resetModules()` + `await import(x)`          | for CJS-loaded modules use `delete cjsRequire.cache[cjsRequire.resolve(x)]; cjsRequire(x)` |
| `jest.isolateModulesAsync(async () => …)`                                                                                                                    | `vi.resetModules()` then fresh `await import()`s |                                                                                            |
| `jest.Mock`                                                                                                                                                  | `import type { Mock } from 'vitest'`             | type-only import                                                                           |
| `jest.SpyInstance`                                                                                                                                           | `import type { MockInstance } from 'vitest'`     | type-only import                                                                           |
| `jest.MockedFunction`                                                                                                                                        | `import type { MockedFunction } from 'vitest'`   | type-only import                                                                           |
| `it('x', (done) => …)`                                                                                                                                       | return a promise                                 | Vitest has no `done` callback                                                              |
| `xdescribe` / `xit`                                                                                                                                          | `describe.skip` / `it.skip`                      | not defined in Vitest                                                                      |
| `import { jest } from '@jest/globals'`                                                                                                                       | delete                                           | `vi` is global with `globals: true`                                                        |

Hoisting is real in Vitest: `vi.mock` calls are lifted to the top of the file,
above imports _and_ above any `const` the factory closes over. Anything a
factory needs must go through `vi.hoisted(() => …)`.

---

## Step 6 — Hand-fix the semantic gaps

This is where the time goes. The catalogue, from the `packages/nx` migration:

**Frozen ESM namespaces.** `vi.spyOn(semverNamespace, 'gt')` throws on a
node builtin or an external ESM package — the namespace object is frozen.
Mock at the module level in spy mode, which keeps the real implementations
until a test overrides one:

```ts
vi.mock('semver', { spy: true });
vi.mock('child_process', { spy: true });
```

**Modules the source loads with bare `require()`.** `vi.mock` never sees that
channel. Use the helper (add it if the package does not have one — it lives in
`packages/nx/src/internal-testing-utils/cjs-mock.ts` and patches
`Module._load`):

```ts
import { mockCjsModule } from '<path>/internal-testing-utils/cjs-mock';
mockCjsModule(import.meta.url, './run', { runCommand: vi.fn() });
```

Registrations are per-file (Vitest forks per file), but a swap made for a
single test must be undone with `unmockCjsModule` / `resetCjsMocks` or it leaks
into later tests in the same file.

**Class mocks must be constructible.** `vi.fn()` returning an object is not
`new`-able the way jest's auto-mock was. Return a real function with a
`prototype`, as `GuardedWorkspaceContext` does in `vitest.setup.mts`.

**`vi.resetAllMocks()` restores a spy's real implementation** rather than
leaving `() => undefined` like jest. Specs that relied on the jest behavior
(expecting `undefined` after a reset) need explicit `mockReturnValue(undefined)`.

**Setup-file mocks must not use `vi.fn()` for pass-through helpers.** A spec
calling `vi.resetAllMocks()` would wipe the implementation and surface as
"is not iterable" downstream. Use plain functions, as the workspace-context
mock does.

**Hooks that must not return a mock.** `beforeEach(() => vi.fn())` — Vitest
treats a returned function as a teardown callback. Make the body a block.

**Parallelism.** With `maxWorkers: 1` gone, two spec files sharing a temp dir,
a `process.chdir`, or a module-level singleton will now collide. Fix by giving
each file its own `TempFs` root; reach for `test.sequential`/`isolate: false`
only after proving the collision is not the spec's own bug.

**A spec that hangs with no output and no timeout.** The test timeout cannot
fire, because the worker's main thread is blocked in a futex — so the usual
"which test is slow" reflexes give you nothing. Diagnose it from the outside:

```bash
p=$(pgrep -f "workers/forks" | head -1)
cat /proc/$p/wchan                      # futex_do_wait == blocked, not busy
ps -o pcpu= -p $p                       # ~0% confirms it is not just slow
ls -l /proc/$p/fd | grep -v socket      # the lock file it is stuck on
pgrep -aP $p                            # a spawned worker/install it waits for
```

In `packages/workspace` this was `project-graph.lock`: real graph construction
running on the CJS channel. The three causes seen so far are all handled by
`scripts/vitest-setup.mts` — CJS graph mocks, `NX_ISOLATE_PLUGINS=false`, and
the `@clack/prompts` stub — so first check the setup is actually loaded before
hunting further.

**Watch for latent test bugs.** Both spec bugs the `packages/nx` migration
uncovered were assertions that passed while the mock never applied. If a spec
starts failing after the mock finally lands, the _test_ was wrong — fix the
expectation, do not paper over it by restoring the broken mock.

---

## Step 7 — Snapshots

Vitest joins describe and test names with `>` where jest used a space, so
**every** existing key reads as new: a plain run appends a full second copy of
the file and leaves the jest entries orphaned. Regenerate from a pristine tree
so `-u` also drops the old keys:

```bash
git checkout -- 'packages/<name>/**/__snapshots__/*.snap'
cp -r <snapshots> tmp/snapshot-baseline/          # keep the jest originals
pnpm nx test <name> --skip-nx-cache -- -u
```

Then prove the _values_ did not move: parse both sides into `{key: value}`,
normalize the separator (`' > '` → `' '`), and diff. Key counts and every value
must match — that is the real parity check, not the pass/fail.

`toThrowErrorMatchingInlineSnapshot` is the known exception: vitest records
`[Error: msg]` where jest recorded `"msg"`. Same message, different serializer.

Vitest's serializer differs from Jest's elsewhere too. Regenerate, then **read the diff**:

```bash
pnpm nx test <name> --skip-nx-cache -- -u
git diff --stat -- 'packages/<name>/**/__snapshots__/*'
```

Snapshot churn should be formatting only (quoting, indentation, `Object {` →
`{`). Any change in _content_ is a real behavior difference — investigate it
before accepting. Colorless output is guaranteed by the `NO_COLOR` pin in the
setup file; if you see ANSI codes land in a snapshot, that pin is missing.

---

## Step 8 — Verify

```bash
# same test count as Step 0, and it should be dramatically faster
pnpm nx test <name> --skip-nx-cache

# parallel-safety: repeat runs must be stable, not just green once
pnpm nx test <name> --skip-nx-cache
pnpm nx test <name> --skip-nx-cache

# a single file still works (paths relative to the package root)
pnpm nx run <name>:test -- src/utils/some-file.spec.ts

# nothing else broke
pnpm nx run-many -t test,build,lint -p <name>
pnpm nx affected -t build,test,lint
```

Parity is **test count**, not just a green run. A dropped `include` pattern or
a silently-skipped directory shows up as a lower count, and a green suite hides
it. If the count differs, find every missing file before proceeding.

Note the caching caveat: after a mechanical sweep, `nx affected` can replay a
stale cached pass. Always validate with `--skip-nx-cache`.

---

## Step 9 — Clean up and document

- Delete `packages/<name>/jest.config.cts` and any package-local jest resolver
  or setup file whose behavior you ported.
- If this was the last jest project touching a `scripts/jest-mocks/*` shim or a
  branch of `scripts/unit-test-setup.js`, delete it. If not, leave it and say
  so in the PR body — the `packages/nx` PR explicitly deferred the dead
  `scripts/unit-test-setup.js` branches to a follow-up rather than mixing them
  in.
- Update `CONTRIBUTING.md` — it documents `npx jest <path>` for targeting a
  single test. Add the package to the vitest note next to `packages/nx`.
- Format: `npx oxfmt <changed files>` (check the branch's own `check` target
  first — a feature branch may still run pretty-quick).
- Do **not** run a full `nx affected`: a new file under `scripts/` marks all 90+
  projects affected, which is hours of jest. Nothing jest reads has changed
  (`jest.preset.js`, `scripts/unit-test-setup.js`,
  `scripts/patched-jest-resolver.js` are untouched), so run one still-on-jest
  package as a canary instead — `devkit` is the most entangled.
- Write `tmp/notes/vitest-migration-<name>.md`: before/after test count and
  wall time, the list of hand-fixed specs and why, and anything deferred.

## Commit shape

Follow the reference PR — small, reviewable, conventional-commit slices:

1. `chore(<scope>): add vitest config and setup for <name> unit tests`
2. `chore(<scope>): codemod jest.* to vi.* in <name> specs`
3. one commit per class of hand fix (CJS-channel mocks, frozen namespaces,
   constructor mocks, hook cleanup, …)
4. `chore(<scope>): regen <name> snapshots for vitest`
5. `chore(<scope>): remove <name> jest config`

PR body: fill the template, state the before/after test count and wall time,
list what the vitest config reproduces from the jest setup, and call out any
latent test bug the migration exposed.
