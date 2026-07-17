# Vitest 3.0 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace containing multiple Vitest projects to Vitest 3.0. The workspace may currently be on Vitest 1.x or Vitest 2.x. This guide covers breaking changes for both upgrade paths:

- **From Vitest 1.x**: apply BOTH the "Vitest 1.x → 2.0" and "Vitest 2.x → 3.0" sections below.
- **From Vitest 2.x**: apply only the "Vitest 2.x → 3.0" section.

Work systematically through each breaking change category.

<pre_pass_summary note="a deterministic pre-pass already applied these specific edits; verify the new shape is in place rather than redoing them">

The pre-pass handled, mechanically:

- `--segfault-retry` removal from `package.json` scripts AND `project.json` `options.{args,command,commands}`
- `@vitest/coverage-c8` → `@vitest/coverage-v8` package rename (preserving the user's pin)
- `vitest typecheck` → `vitest --typecheck` in `package.json` scripts AND `project.json` `options.{args,command,commands}`
- `SnapshotEnvironment` import path `'vitest'` → `'vitest/snapshot'` (only when it is the sole named binding)
- `browser.provider: 'none'` → `'preview'` (only when the value is a direct string literal under `test.browser.provider`)
- `browser.indexScripts` → `orchestratorScripts` (only as a direct property name)

The pre-pass **does not** edit CI provider configs (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `.circleci/config.yml`, `bitbucket-pipelines.yml`) — YAML structure varies too much. Any matches it finds there are forwarded to you in `<advisory_context>`.

**The vast majority of action items below are NOT covered by the pre-pass** and still require your attention — every section other than the six items above.

How to read the wrapper sections above this file:

- `<files_changed>` lists files the pre-pass already wrote to. Verify the new shape is in place; do not re-apply the same edit.
- `<advisory_context>` lists detections the pre-pass forwarded because it could not safely complete them. **Every entry is pending work** — address each one in the relevant section below, not as a separate task.

</pre_pass_summary>

<handoff_guidance>
In your handoff `summary` (1–3 sentences per the system prompt), name the breaking-change categories you applied; explicitly call out any you skipped because they didn't apply (e.g., "no browser-mode configs in this workspace").
</handoff_guidance>

## Pre-Migration Checklist

1. **Identify the current Vitest version**:

   ```bash
   npx vitest --version
   ```

2. **Identify all Vitest projects**:

   ```bash
   nx show projects --with-target test
   ```

3. **Locate all Vitest configuration files**:
   - Search for `vitest.config.{ts,js,mjs}`
   - Search for `vitest.workspace.{ts,js,mjs}` (deprecated in Vitest 3.2 — see "v3.2 Workspace File Deprecation" below)
   - Check `project.json` files for `@nx/vitest:test` / `@nx/vite:test` executor options
   - For workspaces relying on the inferred plugin (`@nx/vitest/plugin`), targets come from inference — inspect them with `nx show project <name> --json | jq .targets`

4. **Identify affected code**:
   - Test files: `**/*.{spec,test}.{ts,js,tsx,jsx}`
   - Mock usage: files using `vi.fn()`, `vi.spyOn()`, `vi.mock()`, `vi.useFakeTimers()`
   - Coverage configuration references
   - Browser mode configurations
   - Custom reporters, sequencers, and snapshot-related imports

---

## Nx-Specific Notes (read first)

- **Inferred plugin targets**: modern Nx workspaces use `@nx/vitest/plugin` (or `@nx/vite/plugin` historically) to _infer_ the test target from the presence of a `vitest.config.*` file. `project.json` may have no `test` target at all. Renaming or moving `vitest.config.*` invalidates inference. After config edits, run `nx reset && nx show project <name>` on a sample project to confirm the target is still present.
- **Shared base config pattern**: many Nx workspaces extend a workspace-root `vitest.config.base.ts` via `mergeConfig`. Apply transforms to the BASE config first, then per-project overrides. Otherwise a migrated base may conflict with un-migrated children.
- **Angular projects using AnalogJS** (`@analogjs/vitest-angular`, `@analogjs/vite-plugin-angular`): the Analog packages are bumped automatically by Nx's `packageJsonUpdates`. Review the Analog-specific setup file (typically `src/test-setup.ts`) and any plugin invocations in the per-project `vitest.config.ts` for changes between Analog `~1.x` and `~2.x` lines.
- **CI configuration**: when `@nx/vitest/plugin` is configured with `ciTargetName`, per-test-file targets are inferred — your `.github/workflows/*.yml` doesn't need direct reporter changes. CI-side reporter config matters only if you bypass the plugin.

---

## Vitest 1.x → 2.0 Breaking Changes

Skip this section if your workspace is already on Vitest 2.x.

### 1.1 Default Pool Changed from `threads` to `forks`

**Search Pattern**: `poolOptions` in all `vitest.config.*` files

**What Changed**: The default `pool` switched from `threads` to `forks` for improved stability. Existing `poolOptions.threads` configurations now apply to the non-default pool unless `pool` is explicitly set.

```typescript
// ❌ BEFORE (Vitest 1.x — relying on implicit `threads` default)
export default defineConfig({
  test: {
    poolOptions: {
      threads: { singleThread: true },
    },
  },
});

// ✅ AFTER (Vitest 2.0 — either explicitly set the pool or move options to `forks`)
export default defineConfig({
  test: {
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
```

**Action Items**:

- [ ] If a project relied on the implicit pool, decide whether to keep `threads` (set `pool: 'threads'` explicitly) or move options to `forks`.
- [ ] Migrate `poolOptions.threads.singleThread` → `poolOptions.forks.singleFork` if switching.
- [ ] Migrate `poolOptions.threads.maxThreads/minThreads` → `poolOptions.forks.maxForks/minForks` if switching.

<fail_if note="this decision changes runtime semantics; if you can't determine the project's intent from the workspace, write status: failed and explain in summary">
You cannot determine whether the workspace intended the v1.x implicit-`threads` behavior (e.g., the codebase uses worker-only APIs like `SharedArrayBuffer`) or expected the v2.x `forks` default. Do not guess.
</fail_if>

### 1.2 Hook Execution Order: Now Serial (and Reverse for `after*`)

**Search Pattern**: `beforeAll`, `beforeEach`, `afterAll`, `afterEach` usages relying on parallel execution

**What Changed**: Hooks moved from parallel to serial execution. `afterAll`/`afterEach` now run in reverse declaration order. Tests relying on parallel hook side effects or specific teardown ordering may break.

```typescript
// To revert to parallel behavior:
export default defineConfig({
  test: {
    sequence: {
      hooks: 'parallel',
    },
  },
});
```

**Action Items**:

- [ ] Audit hooks that mutate shared state — they now execute sequentially in declaration order.
- [ ] Audit `afterAll`/`afterEach` hooks that depend on registration order; their order is now reversed.
- [ ] Add `sequence.hooks: 'parallel'` only if you cannot otherwise resolve hook-order dependencies.

### 1.3 Concurrent Suites Now Run All Tests Concurrently

**Search Pattern**: `describe.concurrent`, `suite.concurrent`

**What Changed**: Declaring `concurrent` on a suite now runs all its tests concurrently (Jest-aligned) instead of grouping by suite. Bound by `maxConcurrency`.

**Action Items**:

- [ ] Review concurrent suites for shared mutable state that previously serialized through suite grouping.
- [ ] Adjust `maxConcurrency` if needed.

### 1.4 V8 Coverage: `ignoreEmptyLines` On by Default

**Search Pattern**: `coverage` configuration in `vitest.config.*` (V8 provider)

**What Changed**: `coverage.ignoreEmptyLines` defaults to `true`. Coverage thresholds may shift.

```typescript
// To restore the previous behavior:
export default defineConfig({
  test: {
    coverage: {
      ignoreEmptyLines: false,
    },
  },
});
```

**Action Items**:

- [ ] Re-baseline V8 coverage thresholds if they exist.
- [ ] Set `coverage.ignoreEmptyLines: false` only if you need the prior numbers exactly.

### 1.5 `watchExclude` Option Removed

**Search Pattern**: `watchExclude` in `vitest.config.*`

```typescript
// ❌ BEFORE (Vitest 1.x)
export default defineConfig({
  test: {
    watchExclude: ['node_modules', 'custom/path/**'],
  },
});

// ✅ AFTER (Vitest 2.0)
export default defineConfig({
  server: {
    watch: {
      ignored: ['**/node_modules/**', 'custom/path/**'],
    },
  },
});
```

**Pattern Semantics Note**: `server.watch.ignored` uses **chokidar** patterns, while Vitest 1.x's `watchExclude` accepted simpler relative-path matchers. A literal find-and-replace may over- or under-ignore. Treat each entry as manual review:

- A bare directory name like `'node_modules'` typically needs `'**/node_modules/**'` to match nested occurrences.
- Glob patterns ending in `/**` are usually portable as-is.
- After the rewrite, verify watch mode picks up the right files with `nx test <project> --watch`.

**Action Items**:

- [ ] Move every `test.watchExclude` entry to `server.watch.ignored`, adjusting pattern syntax to chokidar conventions.
- [ ] Remove `watchExclude` from `vitest.config.*`.

<fail_if note="pattern semantics differ between the two options; a blind copy can over- or under-ignore files">
An existing `watchExclude` entry uses a pattern whose chokidar equivalent is ambiguous (e.g., a relative path without `**` wrapping, an entry that may need both `**/foo/**` and `foo/**`). Write status: failed with the specific patterns you're unsure about; the user should decide.
</fail_if>

### 1.6 `--segfault-retry` CLI Flag Removed

**What Changed**: The CLI flag was removed; the underlying issue is fixed by switching to the `forks` pool (now the default).

**Action Items**:

- [ ] Remove `--segfault-retry` from scripts, `project.json` test target options, and CI configuration.

### 1.7 Task API: `.suite` Now Optional, `.testPath` Required

**Search Pattern**: Custom reporters and tooling that traverse the task tree

**What Changed**: Top-level task `.suite` is now optional. Use `.file` (available on all tasks) instead. `expect.getState().testPath` is now always populated; `expect.getState().currentTestName` no longer includes the file name.

**Action Items**:

- [ ] In custom reporters / utilities, replace `.suite` chains with `.file` where the top-level task could be a file root.
- [ ] If you parsed file names out of `currentTestName`, switch to `testPath`.

### 1.8 JSON Reporter Now Includes `task.meta`

**What Changed**: Output shape gained `task.meta` per assertion result.

**Action Items**:

- [ ] If you ingest the JSON reporter output, accept the new `task.meta` field (additive — most consumers will be unaffected).

### 1.9 Mock Generic Types Simplified

**Search Pattern**: `vi.fn<...>(...)`, `Mock<...>`

```typescript
// ❌ BEFORE (Vitest 1.x)
import { type Mock, vi } from 'vitest';

const add = (x: number, y: number): number => x + y;

const mockAdd = vi.fn<Parameters<typeof add>, ReturnType<typeof add>>();
const mockAdd2: Mock<Parameters<typeof add>, ReturnType<typeof add>> = vi.fn();

// ✅ AFTER (Vitest 2.0)
const mockAdd = vi.fn<typeof add>();
const mockAdd2: Mock<typeof add> = vi.fn();
```

**Action Items**:

- [ ] Replace two-generic `vi.fn<Args, Return>()` with single-generic `vi.fn<typeof fn>()` everywhere.
- [ ] Replace two-generic `Mock<Args, Return>` with single-generic `Mock<typeof fn>` everywhere.

### 1.10 `mock.results` No Longer Auto-Resolves Promises

**Search Pattern**: `.mock.results` accesses on async mocks

**What Changed**: For mocks returning Promises, `mock.results` now contains the Promise itself. Use the new `mock.settledResults` for resolved values.

```typescript
// ❌ BEFORE (Vitest 1.x)
const fn = vi.fn().mockResolvedValueOnce('result');
await fn();
const result = fn.mock.results[0]; // 'result' (auto-resolved)

// ✅ AFTER (Vitest 2.0)
const result = fn.mock.results[0]; // a Promise
const settled = fn.mock.settledResults[0]; // 'result'
```

**Action Items**:

- [ ] Replace `.mock.results[i]` reads with `.mock.settledResults[i]` for promise-returning mocks.
- [ ] Consider switching assertions to the new `toHaveResolved*` matchers where appropriate.

### 1.11 Browser Mode Renames

**Search Pattern**: `browser.provider`, `browser.indexScripts` in `vitest.config.*`

**What Changed**: The `none` provider was renamed to `preview` and is now the default. `indexScripts` was renamed to `orchestratorScripts`.

**Action Items**:

- [ ] Rename `browser.provider: 'none'` → `browser.provider: 'preview'`.
- [ ] Rename `browser.indexScripts` → `browser.orchestratorScripts`.

### 1.12 Deprecated APIs Fully Removed in 2.0

**Action Items**:

- [ ] Replace `vitest typecheck` command usages with `vitest --typecheck`.
- [ ] Remove `VITEST_JUNIT_CLASSNAME` and `VITEST_JUNIT_SUITE_NAME` env vars; move equivalent values into JUnit reporter options.
- [ ] If you import `SnapshotEnvironment`, change the import path from `vitest` to `vitest/snapshot`.
- [ ] Replace any `SpyInstance` type imports with `MockInstance`.
- [ ] If you still configure `c8` as a coverage provider, switch to `v8` (`@vitest/coverage-v8`).

---

## Vitest 2.x → 3.0 Breaking Changes

### 2.1 Test Options Argument Position

**Search Pattern**: `test('name', () => {...}, { ... })`, `describe('name', () => {...}, { ... })`

**What Changed**: Test/describe options objects must now be passed as the **second** argument, not the third.

```typescript
// ❌ BEFORE (Vitest 2.x)
test(
  'validation works',
  () => {
    /* ... */
  },
  { retry: 3 }
);

// ✅ AFTER (Vitest 3.0)
test('validation works', { retry: 3 }, () => {
  /* ... */
});
```

A numeric timeout value as the third argument is still accepted (`test('name', () => {}, 1000)`).

**Action Items**:

- [ ] Move every options-object argument from third to second position in `test`, `it`, `describe`, and their variants (`.skip`, `.only`, `.each`, etc.).

### 2.2 Browser Configuration: `browser.instances`

**Search Pattern**: `browser.name`, `browser.providerOptions` in `vitest.config.*`

**What Changed**: `browser.name` and `browser.providerOptions` are **deprecated in v3** (still work, emit warnings) and **removed in v4**. Use `browser.instances` instead. Migrating now silences the v3 warnings and is required before reaching v4.

```typescript
// ❌ BEFORE (Vitest 2.x)
export default defineConfig({
  test: {
    browser: {
      name: 'chromium',
      providerOptions: {
        launch: { devtools: true },
      },
    },
  },
});

// ✅ AFTER (Vitest 3.0)
export default defineConfig({
  test: {
    browser: {
      instances: [
        {
          browser: 'chromium',
          launch: { devtools: true },
        },
      ],
    },
  },
});
```

**Action Items**:

- [ ] Collapse `browser.name` + `browser.providerOptions` into a single entry in `browser.instances`.
- [ ] Remove `browser.name` and `browser.providerOptions`.

### 2.3 `mockReset()` Restores Original Implementation

**Search Pattern**: `.mockReset()`, `mockReset: true` in `vitest.config.*`

**What Changed**: `spy.mockReset()` now restores the original implementation rather than replacing it with a noop returning `undefined`.

```typescript
// Behavior change illustration:
const foo = { bar: () => 'Hello, world!' };
vi.spyOn(foo, 'bar').mockImplementation(() => 'Hello, mock!');
foo.bar(); // 'Hello, mock!'

foo.bar.mockReset();
foo.bar(); // BEFORE: undefined  →  AFTER: 'Hello, world!'
```

**Action Items**:

- [ ] Audit tests that rely on the post-reset behavior returning `undefined`; explicitly mock to a noop if needed (`vi.spyOn(foo, 'bar').mockReturnValue(undefined)`).
- [ ] If you set `mockReset: true` globally, expect spied methods to return their original implementation between tests.

### 2.4 `vi.spyOn()` Reuses Existing Mocks

**Search Pattern**: Repeated `vi.spyOn(obj, 'method')` on the same target

**What Changed**: Calling `vi.spyOn()` on an already-mocked method now returns the existing mock rather than creating a new one. After `vi.restoreAllMocks()`, the method is no longer a mock.

```typescript
vi.spyOn(fooService, 'foo').mockImplementation(() => 'bar');
vi.spyOn(fooService, 'foo').mockImplementation(() => 'bar');
vi.restoreAllMocks();
vi.isMockFunction(fooService.foo);
// BEFORE: true (the second spy survived restore)
// AFTER:  false (both calls referenced the same spy)
```

**Action Items**:

- [ ] Audit tests that double-spied on the same method expecting two independent mocks.
- [ ] Audit tests that asserted a method remained mocked after `restoreAllMocks` — they will now see the original.

### 2.5 Fake Timers Mock Everything by Default

**Search Pattern**: `vi.useFakeTimers()` usages and `fakeTimers.toFake` config

**What Changed**: Vitest now mocks **all** timer-related APIs by default (the previously-restricted built-in subset is gone). This includes `performance.now()`. Only `nextTick` is left unmocked. To restore the prior, narrower subset, configure `fakeTimers.toFake` explicitly.

```typescript
// To restore the prior subset:
export default defineConfig({
  test: {
    fakeTimers: {
      toFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'Date',
      ],
    },
  },
});
```

**Action Items**:

- [ ] Audit tests using `vi.useFakeTimers()` that observe `performance.now()` or other newly-faked APIs.
- [ ] Restrict `fakeTimers.toFake` if a test should leave specific timer APIs real.

### 2.6 Stricter Error Equality

**Search Pattern**: `toEqual(new Error(...))`, `toThrowError(new Error(...))`

**What Changed**: Error comparisons via `toEqual()` and `toThrowError()` now check `name`, `message`, `cause`, `AggregateError.errors`, and prototype.

```typescript
// Cause is checked asymmetrically:
expect(new Error('hi', { cause: 'x' })).toEqual(new Error('hi')); // ✅ passes
expect(new Error('hi')).toEqual(new Error('hi', { cause: 'x' })); // ❌ fails

// Prototype is checked:
expect(() => {
  throw new TypeError('type error');
})
  .toThrowError(new Error('type error')) // ❌ fails (Error vs TypeError)
  .toThrowError(new TypeError('type error')); // ✅ passes
```

**Action Items**:

- [ ] Update assertions that pass a base `Error` to match a subclassed throw — use the matching subclass.
- [ ] Update assertions whose expected error has a `cause`/`name` that the actual error lacks.

### 2.7 Vite 6 + Vitest 3: `module` Condition Excluded from `resolve.conditions`

**Applies when**: Workspace is on Vite 6 (and Vitest 3 with Vite 6).

**What Changed**: `module` is excluded from `resolve.conditions` by default to align with the upstream Vite 6 migration.

**Action Items**:

- [ ] If a dependency requires the `module` condition for tests, add it explicitly to `resolve.conditions` in your Vitest config.

### 2.8 Hook Signature: `onTestFinished` / `onTestFailed` Receive Context

**Search Pattern**: `onTestFinished`, `onTestFailed` usages in custom reporters or test utilities

**What Changed**: These hooks now receive a test context as the first argument, matching `beforeEach`/`afterEach`.

**Action Items**:

- [ ] Update `onTestFinished`/`onTestFailed` callbacks to take a context argument and access the previous "result" through it.

### 2.9 `Custom` Type Deprecated; `WorkspaceSpec` Removed

**Search Pattern**: `import { Custom, WorkspaceSpec } from 'vitest'`

**What Changed**: `Custom` is now an alias for `Test`; prefer `RunnerCustomCase` and `RunnerTestCase`. `WorkspaceSpec` is removed — use `TestSpecification` instead. Tasks created via `getCurrentSuite().custom()` now have `type: 'test'`.

**Action Items**:

- [ ] Replace `import { Custom } from 'vitest'`: most usages should become `RunnerTestCase` (the regular test case type — `Custom` was an alias for `Test`). Only use `RunnerCustomCase` if the workspace explicitly creates tasks via `getCurrentSuite().custom()`.
- [ ] Replace `WorkspaceSpec` references with `TestSpecification`.

### 2.10 `resolveConfig()` API Shape Changed

**Search Pattern**: `import { resolveConfig } from 'vitest/node'` (or similar) used by custom tooling

**What Changed**: `resolveConfig()` now takes user configuration and returns a resolved configuration, rather than taking an already-resolved Vite config.

**Action Items**:

- [ ] If you call `resolveConfig()`, pass user config (not already-resolved Vite config) and consume the resolved return value.

### 2.11 `vitest/reporters` Export Slimmed Down

**Search Pattern**: Type imports from `vitest/reporters`

**What Changed**: `vitest/reporters` now exports only reporter implementations and their option types. Task types (`TestCase`, `TestSuite`, etc.) moved.

**Action Items**:

- [ ] Move task-type imports (`TestCase`, `TestSuite`, related) from `vitest/reporters` to `vitest/node`.

### 2.12 Test Files Always Excluded from Coverage

**Search Pattern**: `coverage.excludes` in `vitest.config.*` attempting to include test files

**What Changed**: Test files are always excluded from coverage, even if `coverage.excludes` is customized.

**Action Items**:

- [ ] Remove any `coverage.excludes` patterns that were trying to surface test files in coverage — they no longer apply.

### 2.13 Snapshot Internal API Restructured

**Applies when**: A workspace consumes `@vitest/snapshot` directly (custom snapshot tooling).

**What Changed**: The public Snapshot API in `@vitest/snapshot` was restructured to support multiple states within a single run. The `.toMatchSnapshot()` matcher API is unchanged.

**Action Items**:

- [ ] Most workspaces have nothing to do here. If you maintain custom snapshot tooling against `@vitest/snapshot`, review your usage against the v3 API.

### 2.14 Workspace → Projects (v3.2 option rename, v4 file removal)

**Applies when**: Workspace has `vitest.workspace.{ts,js,mjs}` files, uses `defineWorkspace`, or has `test.workspace` set in `vitest.config.*`.

**What Changed**:

- **Vitest 3.2**: introduced `test.projects` as the config option, with `test.workspace` deprecated in favor of it (the option emits a deprecation warning).
- **Vitest 4**: the external file form (`vitest.workspace.*` + `defineWorkspace`) is **removed entirely**. Projects must be inlined in the root `vitest.config.*`.

Migrating now (while still on v3) clears the v3.2 deprecation warning and is required before reaching v4.

```typescript
// ❌ DEPRECATED (Vitest 3.2+)
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';
export default defineWorkspace(['apps/*', 'libs/*']);

// ✅ AFTER (inline in root vitest.config.ts)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: ['apps/*', 'libs/*'],
  },
});
```

**Action Items**:

- [ ] Move project list from `vitest.workspace.*` into `test.projects` in the root `vitest.config.*`.
- [ ] Delete the `vitest.workspace.*` file once migration is complete.
- [ ] If you import `defineWorkspace` anywhere, replace with `defineConfig` and the inlined shape above.
- [ ] If you continue to Vitest 4, this step is required, not optional.

---

## Post-Migration Verification

1. Reinstall: `pnpm install` (or `npm install` / `yarn install`)
2. Run affected tests: `nx affected -t test`
3. Re-baseline coverage on key projects: `nx run <project>:test --coverage`
4. Typecheck custom reporters / sequencers / snapshot tooling: `nx affected -t typecheck`
5. Watch mode (if applicable): verify `server.watch.ignored` covers what `watchExclude` previously did.

Confirm:

- All configuration files updated
- All test files pass (or are flagged in your handoff `summary` if they remain failing — see `<test_integrity_guardrails>` below)
- Coverage reports generate correctly
- No deprecated API warnings in console

<test_integrity_guardrails note="violating any of these masks regressions and defeats the migration's purpose">

- Do NOT force tests to pass by replacing test logic with `expect(true).toBe(true)`.
- Do NOT remove assertions to silence a failure.
- Do NOT add mocks that exist solely to make a failing test pass.

If a test cannot be made to pass within the scope of this migration, leave it failing and report it in your handoff `summary`.

</test_integrity_guardrails>

## References

- Vitest 2.0 migration guide: https://v2.vitest.dev/guide/migration
- Vitest 3.0 migration guide: https://v3.vitest.dev/guide/migration
- Vitest 4.0 migration guide (for cascading bumps): https://vitest.dev/guide/migration
- Vitest releases: https://github.com/vitest-dev/vitest/releases
