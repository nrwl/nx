# Vitest 4.0 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace containing multiple Vitest projects from Vitest 3.x to Vitest 4.0. Work systematically through each breaking change category.

<pre_pass_summary note="a deterministic pre-pass already applied these specific edits; verify the new shape is in place rather than redoing them">

The pre-pass handled, mechanically:

- dead `coverage.{all,extensions,ignoreEmptyLines,experimentalAstAwareRemapping}` removal
- `test.workspace` → `test.projects` rename (the property form)
- inlining of static `vitest.workspace.*` files (a plain array of glob strings) into the root `vitest.config.*` under `test.projects`, deleting the workspace file. Workspace files the pre-pass could not safely inline are forwarded to you: dynamic content (imports, spreads, object entries), an empty project list, or a sibling config it could not merge into (an existing `test.projects`/`test.workspace`, a non-object-literal config, or a directory that only has a `vite.config.*`)
- when the inlined globs matched both a `vite.config.*` and a `vitest.config.*` in the same directory resolving to the same project name, a negative glob excluding the `vite.config.*` was appended (avoids vitest's duplicate-project-name startup error). When either config's project name could not be statically determined, an advisory was forwarded to you instead
- minimal local `vitest.config.*` files for packages that run vitest via a package.json script but had no local config. Without one, Vitest 4 climbs from the package directory to the root `test.projects` config, resolves the globs relative to the package directory, and fails with "No projects were found"
- `@vitest/browser/context` import-path rewrite to `vitest/browser`
- `deps.optimizer.web` → `deps.optimizer.client` rename
- `poolOptions.threads.useAtomics` and top-level `test.minWorkers` removal
- `'verbose'` → `'tree'` and `'basic'` → `['default', { summary: false }]` inside `test.reporters`
- `VITEST_MAX_{THREADS,FORKS}` → `VITEST_MAX_WORKERS` and `VITE_NODE_DEPS_MODULE_DIRECTORIES` → `VITEST_MODULE_DIRECTORIES` renames in: `package.json` scripts, `.env` / `.env.*` files, `project.json` `options.env` keys, and inline `VAR=value` prefixes inside `project.json` `options.{args,command,commands}`

The pre-pass **skips the rename when both `VITEST_MAX_THREADS` and `VITEST_MAX_FORKS` appear in the same file/scope** (they collapse to a single `VITEST_MAX_WORKERS` whose value depends on which pool the project uses — a decision the pre-pass can't make safely). It also **does not** edit CI provider configs (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `.circleci/config.yml`, `bitbucket-pipelines.yml`) — YAML structure varies too much. Any conflicts and any CI matches are forwarded to you in `<advisory_context>`.

**The cross-cutting changes below still require your attention** — pool option flattening (`singleThread`/`singleFork`, `maxThreads`/`maxForks`, `poolOptions.<pool>.{execArgv,isolate}`, `poolOptions.vmThreads.memoryLimit`), `test.deps.{external,inline,fallbackCJS}` → `test.server.deps.*` move, `test.{poolMatchGlobs,environmentMatchGlobs}` projects rewrite, browser provider function-form rewrite, `browser.testerScripts` → `testerHtmlPath`, inlining of `vitest.workspace.*` files the pre-pass could not inline automatically (+ `defineWorkspace` removal), custom reporter callback API updates, and `@vitest/browser` package replacement with per-provider packages.

How to read the wrapper sections above this file:

- `<files_changed>` lists files the pre-pass already wrote to. Verify the new shape is in place; do not re-apply the same edit.
- `<advisory_context>` lists detections the pre-pass forwarded because it could not safely complete them. **Every entry is pending work** — address each one in the relevant section below, not as a separate task.

A workspace-wide reminder is also emitted as a post-run "next step" about env vars set in CI provider dashboards — those can't be detected from the workspace tree.

</pre_pass_summary>

<handoff_guidance>
In your handoff `summary` (1–3 sentences per the system prompt), name the breaking-change categories you applied; explicitly call out any you skipped because they didn't apply (e.g., "no custom reporters in this workspace", "no browser-mode configs").
</handoff_guidance>

<prerequisites note="hard runtime requirements; do not edit any vitest config until these are satisfied">

Vitest 4 has hard runtime requirements:

- **Vite ≥ 6.0.0** (Vite 5 is unsupported). Check with `npx vite --version`. If on Vite 5, apply the Vite 6 / 7 / 8 migration guides first.
- **Node.js ≥ 20.0.0** (Node 18 support dropped). Check with `node --version`. Update CI `actions/setup-node` versions, `.nvmrc`, `engines` in `package.json`, and Docker base images.

If either prerequisite is unmet, write status: failed with the unmet requirement in `summary` — config-level migration on an unsupported runtime will produce confusing errors.

</prerequisites>

## Nx-Specific Notes (read first)

- **Inferred plugin targets**: modern Nx workspaces use `@nx/vitest/plugin` (or historically `@nx/vite/plugin`) to _infer_ test targets from `vitest.config.*` presence. `project.json` may have no `test` target. Inspect inferred targets with `nx show project <name> --json | jq .targets`. Renaming/moving `vitest.config.*` invalidates inference; run `nx reset` after structural moves.
- **`@nx/vitest:test` / `@nx/vite:test` executor options**: when present in `project.json`, the relevant options are `configFile`, `reportsDirectory`, `mode`, `testFiles`, `watch`. Most option-level breaking changes in v4 are inside `vitest.config.*`, not these. The exception: any `--segfault-retry` in the executor `args` is now invalid and must be removed.
- **Shared base config**: apply transforms to a workspace-root `vitest.config.base.ts` (extended via `mergeConfig`) BEFORE per-project overrides. Otherwise inherited options may shadow the migrated ones.
- **Angular projects using AnalogJS** (`@analogjs/vitest-angular` / `@analogjs/vite-plugin-angular`): the Analog packages are bumped automatically by Nx's `packageJsonUpdates` (to the `~2.2.x` line). Review `src/test-setup.ts` and Analog plugin invocations in per-project `vitest.config.ts`.

## Pre-Migration Checklist

1. **Identify all Vitest projects**:

   ```bash
   nx show projects --with-target test
   ```

2. **Locate all Vitest configuration files**:
   - Search for `vitest.config.{ts,js,mjs}`
   - Search for `vitest.workspace.{ts,js,mjs}` (removed in Vitest 4 — migrate to inline `test.projects`; see section 1.3 below)
   - Check `project.json` files for `@nx/vitest:test` / `@nx/vite:test` executor options
   - For workspaces relying on the inferred plugin (`@nx/vitest/plugin`), targets come from inference — inspect them with `nx show project <name> --json | jq .targets`

3. **Identify affected code**:
   - Test files: `**/*.{spec,test}.{ts,js,tsx,jsx}`
   - Mock usage: Files using `vi.fn()`, `vi.spyOn()`, `vi.mock()`
   - Coverage configuration references

## Migration Steps by Category

### 1. Configuration File Updates

#### 1.1 Coverage Configuration

**Search Pattern**: `coverage` in all `vitest.config.*` files and `project.json` test target options

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    coverage: {
      all: true,
      extensions: ['.ts', '.tsx'],
      ignoreEmptyLines: false,
      experimentalAstAwareRemapping: true,
    },
  },
});

// ✅ AFTER (Vitest 4.0)
export default defineConfig({
  test: {
    coverage: {
      // Explicitly define files to include in coverage
      include: ['src/**/*.{ts,tsx}'],
      // Remove: all, extensions, ignoreEmptyLines, experimentalAstAwareRemapping
    },
  },
});
```

**Action Items**:

- [ ] Remove `coverage.all` option
- [ ] Remove `coverage.extensions` option
- [ ] Remove `coverage.ignoreEmptyLines` option
- [ ] Remove `coverage.experimentalAstAwareRemapping` option
- [ ] Add explicit `coverage.include` patterns based on project structure
- [ ] Update any documentation referencing these options

#### 1.2 Pool Options Restructuring

**Search Pattern**: `poolOptions`, `maxThreads`, `maxForks`, `singleThread`, `singleFork` in all Vitest config files

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x — pool serialized via singleThread/singleFork)
export default defineConfig({
  test: {
    maxThreads: 4,
    maxForks: 2,
    singleFork: true,
    poolOptions: {
      forks: {
        execArgv: ['--expose-gc'],
        isolate: false,
      },
      threads: {
        useAtomics: true,
      },
      vmThreads: {
        memoryLimit: '512MB',
      },
    },
  },
});

// ✅ AFTER (Vitest 4.0 — top-level pool config)
export default defineConfig({
  test: {
    maxWorkers: 1, // singleFork: true => maxWorkers: 1, isolate: false
    isolate: false,
    execArgv: ['--expose-gc'], // moved from poolOptions.forks
    vmMemoryLimit: '512MB', // moved from poolOptions.vmThreads.memoryLimit
    // Remove: poolOptions, threads.useAtomics, minWorkers (also removed in v4)
  },
});
```

**Action Items**:

- [ ] Replace `maxThreads` and `maxForks` with a single `maxWorkers` option. If both values were set with different numbers (one for threads pool, one for forks pool), pick the value matching the pool the project actually uses — `maxWorkers` is pool-agnostic in v4.
- [ ] Replace `singleThread: true` or `singleFork: true` with `maxWorkers: 1, isolate: false`.
- [ ] If `singleThread: false` or `singleFork: false` was set explicitly, just delete — it's the default.
- [ ] Move `poolOptions.{forks,threads}.execArgv` → top-level `execArgv`.
- [ ] Move `poolOptions.{forks,threads}.isolate` → top-level `isolate`.
- [ ] Move `poolOptions.vmThreads.memoryLimit` → top-level `vmMemoryLimit`.
- [ ] Remove `poolOptions.threads.useAtomics` (option removed).
- [ ] Remove `minWorkers` if present (option removed; behaves as if set to 0 in non-watch mode).
- [ ] Update CI environment variables: `VITEST_MAX_THREADS` and `VITEST_MAX_FORKS` → `VITEST_MAX_WORKERS`.

<fail_if note="pool flattening is pool-agnostic in v4; picking the wrong value silently changes concurrency">
Both `maxThreads` and `maxForks` are set with different numbers AND the project has no explicit `test.pool` you can use to decide which value `maxWorkers` should take. Do not guess. Write status: failed and ask the user which pool the project uses.
</fail_if>

#### 1.3 Workspace to Projects Rename

**Search Pattern**: `workspace` property in Vitest config files

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    workspace: ['apps/*', 'libs/*'],
  },
});

// ✅ AFTER (Vitest 4.0)
export default defineConfig({
  test: {
    projects: ['apps/*', 'libs/*'],
  },
});
```

**Action Items**:

- [ ] Rename `workspace` property to `projects` in all config files.
- [ ] Inline any external `vitest.workspace.*` content into `test.projects` and delete the workspace file (external file references are no longer supported). The pre-pass already inlined workspace files containing a plain static array of glob strings; the ones you see in `<advisory_context>` were skipped because of dynamic content or because the sibling config could not be merged into mechanically (existing `test.projects`/`test.workspace`, non-object-literal config, or a directory with only a `vite.config.*`). For an existing `test.projects`, merge the workspace entries into it; for a `vite.config.*`-only directory, decide whether its `test` block (if any) and the project list belong in that file or a new `vitest.config.*`.
- [ ] If projects need different pool/environment options, set them inside each project entry rather than via the (now-removed) `poolMatchGlobs` / `environmentMatchGlobs` — see section 1.5.

When you inline a workspace file yourself, also apply these checks (the pre-pass applies them for the files it inlines):

- [ ] **Config-less packages**: a root config with `test.projects` breaks `vitest` invocations from package directories that have no `vite.config.*`/`vitest.config.*` of their own (common for packages with a package.json `"test": "vitest run"` script). Vitest 4 finds the root config by walking up from the package directory, but resolves the `test.projects` globs relative to the package directory, so it errors with "No projects were found". For each such package, create a minimal local config so vitest stops at it and `@nx/vitest` infers the test target:

  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {},
  });
  ```

  Do NOT "fix" this by anchoring the root globs to the workspace root instead: that makes the package-directory invocation run every project in the workspace while still skipping the config-less package's own tests. Skip packages whose vitest script already passes an explicit `--config`/`-c`/`--root` (space- or `=`-joined); those don't rely on config discovery.

- [ ] **Duplicate project names**: when the inlined globs match both a `vite.config.*` and a `vitest.config.*` in the same directory and both resolve to the same project name (the default name is the directory's package.json name, so two name-less configs always collide), vitest errors at startup with "Project name ... is not unique". Append a negative glob excluding the `vite.config.*` file (e.g. `'!packages/foo/vite.config.ts'`), matching vitest's own vitest-over-vite preference. Leave directories whose configs have distinct explicit `test.name` values alone; those are intentionally separate projects.

- [ ] **Root config self-match**: when the inlined globs match the root config file itself (e.g. `**/vitest.config.*` matches the `vitest.config.*` you inlined into), vitest resolves that root config as an extra project. A pure aggregator has no `include` of its own, so this extra project re-runs every test via vitest's default glob without each project's `environment`/`setupFiles`, duplicating runs and failing tests that depend on their project config. Append a negative glob excluding the root config file (e.g. `'!vitest.config.ts'`, relative to its own directory) so vitest treats it only as the projects orchestrator. Skip this when the root config is itself a real project with its own `test.include`: it runs its own tests and needs no exclusion.

<fail_if note="inlining is a semantic merge, not a copy">
The `vitest.workspace.*` file imports modules / calls functions / uses spreads that you cannot evaluate at edit time (dynamic project arrays, conditional imports). Write status: failed listing the file path and the dynamic shape that needs human resolution.
</fail_if>

#### 1.4 Browser Configuration

**Search Pattern**: `browser.provider`, `browser.testerScripts`, imports from `@vitest/browser`, `@vitest/browser/context`, `@vitest/browser/utils`

**Changes Required**: `browser.provider` is no longer a string. It's now the **return value of a provider function** imported from a per-provider package. Official packages:

- `@vitest/browser-playwright` — exports `playwright(options?)`
- `@vitest/browser-webdriverio` — exports `webdriverio(options?)`
- `@vitest/browser-preview` — exports `preview(options?)` (dev-only)

```typescript
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright', // string
      testerScripts: ['./setup.js'], // array of scripts
    },
  },
});
import { page } from '@vitest/browser/context';
import { getElementError } from '@vitest/browser/utils';

// ✅ AFTER (Vitest 4.0)
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: { slowMo: 100 },
      }),
      instances: [{ browser: 'chromium' }],
      testerHtmlPath: './test-setup.html', // single HTML path replaces script array
    },
  },
});
import { page, utils } from 'vitest/browser';
const { getElementError } = utils;
```

**Action Items**:

- [ ] Install the appropriate provider package: `@vitest/browser-playwright`, `@vitest/browser-webdriverio`, or `@vitest/browser-preview`. Match whatever your `browser.provider` string was previously.
- [ ] Remove `@vitest/browser` from `dependencies`/`devDependencies` — its public surface moved into the main `vitest` package and the per-provider packages.
- [ ] Replace string `browser.provider: 'name'` with the function-call form: `provider: <providerFn>(<options>)`.
- [ ] Replace `browser.testerScripts: [...]` with `browser.testerHtmlPath: '<single-file>.html'`. Note: this is a **semantic** change (array of scripts → one HTML file). Move the script contents into a `<script>` block of the HTML file, or load them with `<script src>` references inside it.
- [ ] Update imports: `@vitest/browser/context` → `vitest/browser`; `@vitest/browser/utils` → `vitest/browser` (named export `utils`).

<fail_if note="provider package selection changes which browser tests actually run against">
The previous `browser.provider` string is dynamic (variable reference, ternary, or constructed at runtime) so you cannot determine which per-provider package to install. Write status: failed and ask the user which provider the project targets.
</fail_if>

#### 1.5 Deprecated Configuration Options

**Search Pattern**: `deps.external`, `deps.inline`, `deps.fallbackCJS` in config files

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    deps: {
      external: ['some-package'],
      inline: ['inline-package'],
      fallbackCJS: true,
    },
  },
});

// ✅ AFTER (Vitest 4.0)
export default defineConfig({
  test: {
    server: {
      deps: {
        external: ['some-package'],
        inline: ['inline-package'],
        fallbackCJS: true,
      },
    },
  },
});
```

**Action Items**:

- [ ] Move `deps.*` options under `server.deps` namespace.
- [ ] Rename `deps.optimizer.web` → `deps.optimizer.client` (separate rename, same area).
- [ ] Remove `poolMatchGlobs` (use `projects` with conditions instead).
- [ ] Remove `environmentMatchGlobs` (use `projects` with conditions instead).

#### 1.6 Default Test File Exclusions Narrowed

**Search Pattern**: workspaces that have non-test files in `dist/`, `cypress/`, `.idea/`, `.cache/`, `.output/`, `.temp/`, or root config files (`rollup.config.*`, `prettier.config.*`, etc.) that look like test files.

**What Changed**: Vitest 4 excludes ONLY `node_modules` and `.git` by default. Previously, additional directories and root config files were excluded. Workspaces with `*.{spec,test}.*`-named files in those previously-excluded locations will see them picked up by the test runner in v4 unless an explicit exclusion is added.

```typescript
// To restore Vitest 3.x default exclusion behavior:
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
  },
});
```

**Recommendation**: prefer `test.dir` to scope discovery for performance, instead of relying on negative exclusions.

**Action Items**:

- [ ] After upgrading, run `nx test <project>` for each affected project. If new test files surface unexpectedly from `dist/`, `cypress/`, etc., apply the snippet above or add a narrower exclude pattern.
- [ ] Consider setting `test.dir: './src'` (or equivalent) per project to scope discovery to source.

#### 1.7 Custom Environments: `transformMode` → `viteEnvironment`

**Applies when**: A project exports a custom Vitest environment (rare; check for files with `default export` of `{ name, setup, transformMode, ... }` consumed via `test.environment`).

```typescript
// ❌ BEFORE (Vitest 3.x)
export default {
  name: 'my-env',
  setup() {
    /* ... */
  },
  transformMode: 'ssr',
};

// ✅ AFTER (Vitest 4.0)
export default {
  name: 'my-env',
  setup() {
    /* ... */
  },
  viteEnvironment: 'custom-env',
};
```

**Action Items**:

- [ ] If a custom environment file exists, rename its `transformMode` property to `viteEnvironment`.
- [ ] No change needed for workspaces using only built-in environments (`node`, `jsdom`, `happy-dom`, `edge-runtime`).

<fail_if note="viteEnvironment is not a value-for-value swap from transformMode">
The custom environment's `transformMode` value is something other than `'ssr'` or `'web'` (or its replacement Vite-environment name isn't obvious from the workspace). Write status: failed listing the file and the current `transformMode` value.
</fail_if>

### 2. Test Code Updates

#### 2.1 Mock Function Name Changes

**Search Pattern**: `.getMockName()` calls in test files

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
const mockFn = vi.fn();
expect(mockFn.getMockName()).toBe('spy'); // Old default

// ✅ AFTER (Vitest 4.0)
const mockFn = vi.fn();
expect(mockFn.getMockName()).toBe('vi.fn()'); // New default

// If you need custom names, set them explicitly
const namedMock = vi.fn().mockName('myCustomName');
expect(namedMock.getMockName()).toBe('myCustomName');
```

**Action Items**:

- [ ] Update test assertions checking default mock names from `'spy'` to `'vi.fn()'`
- [ ] Add explicit `.mockName()` calls where specific names are required

#### 2.2 Mock Invocation Call Order

**Search Pattern**: `.mock.invocationCallOrder` in test files

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
const mockFn = vi.fn();
mockFn();
expect(mockFn.mock.invocationCallOrder[0]).toBe(0); // Started at 0

// ✅ AFTER (Vitest 4.0)
const mockFn = vi.fn();
mockFn();
expect(mockFn.mock.invocationCallOrder[0]).toBe(1); // Now starts at 1 (Jest-compatible)
```

**Action Items**:

- [ ] Update assertions on `invocationCallOrder` to account for 1-based indexing
- [ ] Search for off-by-one errors in call order comparisons

#### 2.3 Constructor Spies and Mocks

**Search Pattern**: `vi.spyOn` on constructors, `vi.fn()` used as constructors

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x) - Arrow function constructors might have worked
const MockConstructor = vi.fn(() => ({ value: 42 }));
new MockConstructor(); // May have worked in v3

// ✅ AFTER (Vitest 4.0) - Must use function or class
const MockConstructor = vi.fn(function () {
  return { value: 42 };
});
new MockConstructor(); // Correctly supports 'new'

// Or use class syntax
class MockClass {
  value = 42;
}
const MockConstructor = vi.fn(MockClass);
```

**Action Items**:

- [ ] Convert arrow function mocks used as constructors to `function` keyword or `class` syntax
- [ ] Test all constructor spies to ensure `new` keyword works correctly
- [ ] Update any mocks that expect constructor behavior

#### 2.4 RestoreAllMocks Behavior

**Search Pattern**: `vi.restoreAllMocks()` in test files

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
vi.mock('./module', () => ({ fn: vi.fn() }));
vi.restoreAllMocks(); // Would restore automocks

// ✅ AFTER (Vitest 4.0)
vi.mock('./module', () => ({ fn: vi.fn() }));
vi.restoreAllMocks(); // Only restores manual spies, NOT automocks

// To reset automocks, use:
vi.unmock('./module');
// or
vi.resetModules();
```

**Action Items**:

- [ ] Review all `vi.restoreAllMocks()` usage
- [ ] Add explicit `vi.unmock()` or `vi.resetModules()` calls for automocked modules
- [ ] Ensure test isolation is maintained after this change

#### 2.5 SpyOn Return Value Changes

**Search Pattern**: `vi.spyOn()` on already mocked functions

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
const mock = vi.fn();
const spy = vi.spyOn({ method: mock }, 'method');
// spy !== mock (created new spy)

// ✅ AFTER (Vitest 4.0)
const mock = vi.fn();
const spy = vi.spyOn({ method: mock }, 'method');
// spy === mock (returns same instance)
```

**Action Items**:

- [ ] Review code that creates spies on existing mocks
- [ ] Remove redundant spy creation if same instance is returned
- [ ] Update assertions that check spy identity

#### 2.6 Automock Behavior Changes

**Search Pattern**: `vi.mock()` factories with getters, instance methods on automocked classes, `vi.restoreAllMocks()` usage when modules are automocked.

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
vi.mock('./utils', () => ({
  get value() {
    return 42;
  }, // getter executed
}));

import { value } from './utils';
console.log(value); // executes getter, prints 42

// ✅ AFTER (Vitest 4.0)
vi.mock('./utils', () => ({
  get value() {
    return 42;
  },
}));

import { value } from './utils';
console.log(value); // getter NOT executed; prints undefined

// To spy on the getter explicitly:
vi.spyOn(utilsModule, 'value', 'get').mockReturnValue(42);

// Or define as a plain property (not a getter):
vi.mock('./utils', () => ({ value: 42 }));
```

Additional behavior changes for automocked instance methods:

```typescript
// Each instance gets its own mock for the same method name
const a = new AutoMockedClass();
const b = new AutoMockedClass();
a.method.mockReturnValue(42);
expect(a.method()).toBe(42);
expect(b.method()).toBeUndefined(); // independent per instance

// But the prototype is shared: a method mocked on the prototype affects all
// instances that don't have a per-instance mock.
AutoMockedClass.prototype.method.mockReturnValue(100);
b.method.mockReset(); // remove per-instance mock if any
expect(b.method()).toBe(100);
```

`vi.restoreAllMocks()` no longer touches automocks. Use `vi.unmock(modulePath)` or `vi.resetModules()` to clear an automocked module. **`.mockRestore()` on a single spy still works** (resets its implementation and clears state) regardless of whether the underlying module is automocked.

**Action Items**:

- [ ] Replace automocked **getters** that need to return values with plain property definitions, or add an explicit `vi.spyOn(obj, name, 'get').mockReturnValue(...)`.
- [ ] If a test relied on `vi.restoreAllMocks()` clearing an automocked module, add explicit `vi.unmock('./module')` or `vi.resetModules()` calls.
- [ ] Audit tests that mock instance methods of an automocked class; the per-instance independence may surface latent bugs.
- [ ] Do NOT remove `.mockRestore()` calls on single spies — they still work correctly.

#### 2.7 Settled Results Immediate Population

**Search Pattern**: `.mock.settledResults` in test files

**Changes Required**:

```typescript
// ✅ AFTER (Vitest 4.0)
const asyncMock = vi.fn(async () => 'result');
const promise = asyncMock();

// settledResults is immediately populated with 'incomplete' status
expect(asyncMock.mock.settledResults[0]).toEqual({
  type: 'incomplete',
  value: undefined,
});

// After promise resolves
await promise;
expect(asyncMock.mock.settledResults[0]).toEqual({
  type: 'fulfilled',
  value: 'result',
});
```

**Action Items**:

- [ ] Update tests that check `settledResults` before promise resolution
- [ ] Handle `'incomplete'` status in assertions
- [ ] Ensure tests properly await promises before checking settled results

### 3. Reporter and CLI Changes

#### 3.1 Reporter API Changes

**Search Pattern**: custom reporter classes/objects implementing any of these removed callbacks:

- `onCollected`
- `onSpecsCollected`
- `onPathsCollected`
- `onTaskUpdate`
- `onFinished`

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default {
  onCollected(files) {
    /* ... */
  },
  onTaskUpdate(task) {
    /* ... */
  },
  onFinished(files) {
    /* ... */
  },
};

// ✅ AFTER (Vitest 4.0)
// Use the new test-module / test-case event API. See:
// https://vitest.dev/api/advanced/reporters
// Typical replacements:
//   onCollected      → onTestModuleCollected
//   onTaskUpdate     → onTestCaseResult / onTestModuleEnd
//   onFinished       → onTestRunEnd
```

**Action Items**:

- [ ] Audit every custom reporter file for any of the five removed callbacks listed above. Each one needs replacement.
- [ ] Consult the v4 reporters API at https://vitest.dev/api/advanced/reporters for the exact replacement method name and signature.
- [ ] After rewriting, run the reporter in isolation against a small project to verify event delivery before applying workspace-wide.

<fail_if note="custom reporters carry external behavior the migration cannot deduce">
A reporter callback receives or emits data whose v4 equivalent you can't determine from the v4 reporters API alone (e.g., uses internal task tree shapes, depends on event ordering that has no v4 analogue). Write status: failed naming the reporter file and the callback; do not stub.
</fail_if>

#### 3.2 Built-in Reporter Changes

**Search Pattern**: `reporters: ['basic']`, `reporters: ['verbose']`

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    reporters: ['basic'],
  },
});

// ✅ AFTER (Vitest 4.0)
export default defineConfig({
  test: {
    reporters: [['default', { summary: false }]], // Equivalent to 'basic'
  },
});

// For verbose (tree output)
reporters: ['tree']; // Use 'tree' for hierarchical output
```

**Action Items**:

- [ ] Replace `'basic'` reporter with `['default', { summary: false }]`
- [ ] Replace `'verbose'` reporter with `'tree'` for hierarchical output
- [ ] Update CI configuration if reporters are specified there

### 4. Snapshot Changes

#### 4.1 Custom Elements Shadow Root

**Search Pattern**: Snapshot tests involving custom elements or Web Components

**Changes Required**:

```typescript
// ✅ AFTER (Vitest 4.0)
// Shadow root contents now printed by default in snapshots

// If you want old behavior (don't print shadow root):
export default defineConfig({
  test: {
    snapshotFormat: {
      printShadowRoot: false,
    },
  },
});
```

**Action Items**:

- [ ] Review snapshot tests for custom elements
- [ ] Update snapshots if shadow root contents are now included
- [ ] Add `printShadowRoot: false` to `snapshotFormat` if old behavior is required

#### 4.2 `vi.fn` Snapshot String Changed

**Search Pattern**: `__snapshots__/**/*.snap` files containing `[MockFunction spy]`

**What Changed**: The default rendered string for an unnamed mock function in snapshots changed from `[MockFunction spy]` to `[MockFunction]`. Snapshots of mock objects taken in v3 will mismatch on re-run.

**Action Items**:

- [ ] Run tests with `--update` for projects that snapshot mock objects, then review the diff to confirm only the mock-name string changed.
- [ ] Where a specific mock name is asserted in snapshots, add explicit `.mockName('...')` calls.

#### 4.3 Custom Snapshot Matchers: Import Path Change

**Applies when**: A workspace defines custom snapshot matchers using `jest-snapshot`.

**What Changed**: Vitest 4 expects custom snapshot matchers to import from `vitest` (the new `Snapshots` namespace), not `jest-snapshot`.

```typescript
// ❌ BEFORE (Vitest 3.x)
const { toMatchSnapshot } = require('jest-snapshot');

// ✅ AFTER (Vitest 4.0)
import { Snapshots } from 'vitest';
const { toMatchSnapshot } = Snapshots;

expect.extend({
  toMatchTrimmedSnapshot(received: string, length: number) {
    return toMatchSnapshot.call(this, received.slice(0, length));
  },
});
```

**Action Items**:

- [ ] Replace `require('jest-snapshot')` / `import 'jest-snapshot'` in custom matcher files with `import { Snapshots } from 'vitest'`.
- [ ] Remove `jest-snapshot` from `dependencies`/`devDependencies` if it's no longer used elsewhere.

### 5. Environment Variable Updates

**Search Pattern**: CI/CD configuration files, `.env` files, documentation

**Changes Required**:

```bash
# ❌ BEFORE (Vitest 3.x)
VITEST_MAX_THREADS=4
VITEST_MAX_FORKS=2
VITE_NODE_DEPS_MODULE_DIRECTORIES=/custom/path

# ✅ AFTER (Vitest 4.0)
VITEST_MAX_WORKERS=4
VITEST_MODULE_DIRECTORIES=/custom/path
```

**Action Items**:

- [ ] Update CI/CD pipeline environment variables
- [ ] Update `.env` files
- [ ] Update documentation referencing old environment variables
- [ ] Search for `VITEST_MAX_THREADS`, `VITEST_MAX_FORKS`, `VITE_NODE_DEPS_MODULE_DIRECTORIES`

### 6. Advanced: Module Runner Changes

**Search Pattern**: `vitest/execute`, `__vitest_executor`, `vite-node`

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
import { execute } from 'vitest/execute';
// Access to __vitest_executor

// ✅ AFTER (Vitest 4.0)
// Use Vite's Module Runner API instead
// Consult Vite Module Runner documentation
```

**Action Items**:

- [ ] If using `vitest/execute`, migrate to Vite Module Runner
- [ ] Remove dependencies on `__vitest_executor`
- [ ] Update custom pool implementations (complete rewrite needed)

### 7. Type Definition Updates

**Search Pattern**: TypeScript imports from `vitest`, type errors after upgrade

**Changes Required**:

```typescript
// All deprecated type exports removed
// If you get TypeScript errors about missing types:
// - Check if you're using deprecated type names
// - Update to current type names from Vitest 4 API
// - Remove explicit @types/node if it was only needed due to Vitest bug
```

**Action Items**:

- [ ] Run TypeScript compilation on all test files
- [ ] Fix any type errors related to removed Vitest type definitions
- [ ] Review `@types/node` usage (may no longer be accidentally included)

## Post-Migration Validation

1. Run tests per project: `nx test <project>`
2. Run all affected: `nx affected -t test`
3. Check coverage: `nx affected -t test --coverage`
4. Validate CI pipeline: `nx prepush`

Confirm:

- All configuration files updated
- All test files pass (or are flagged in your handoff `summary` if they remain failing — see `<test_integrity_guardrails>` below)
- Coverage reports generate correctly
- Environment variables updated
- No deprecated API warnings in console

<test_integrity_guardrails note="violating any of these masks regressions and defeats the migration's purpose">

- Do NOT force tests to pass by replacing test logic with `expect(true).toBe(true)`.
- Do NOT remove assertions to silence a failure.
- Do NOT add mocks that exist solely to make a failing test pass.

If a test cannot be made to pass within the scope of this migration, leave it failing and report it in your handoff `summary`.

</test_integrity_guardrails>
