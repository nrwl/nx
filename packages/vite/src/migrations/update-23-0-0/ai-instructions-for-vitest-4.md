# Vitest 4.0 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace containing multiple Vitest projects from Vitest 3.x to Vitest 4.0. Work systematically through each breaking change category.

> **Pre-pass already ran**: a deterministic generator ran before these instructions. It only handles purely-mechanical changes:
>
> - dead `coverage.{all,extensions,ignoreEmptyLines,experimentalAstAwareRemapping}` removal
> - `test.workspace` → `test.projects` rename (the property only — external `vitest.workspace.*` files are NOT inlined)
> - `@vitest/browser/context` import-path rewrite to `vitest/browser`
> - `deps.optimizer.web` → `deps.optimizer.client` rename
> - `poolOptions.threads.useAtomics` and top-level `test.minWorkers` removal
> - `'verbose'` → `'tree'` and `'basic'` → `['default', { summary: false }]` inside `test.reporters`
> - `VITEST_MAX_{THREADS,FORKS}` → `VITEST_MAX_WORKERS` and `VITE_NODE_DEPS_MODULE_DIRECTORIES` → `VITEST_MODULE_DIRECTORIES` renames in: `package.json` scripts, `.env` / `.env.*` files, `project.json` `options.env` keys, and inline `VAR=value` prefixes inside `project.json` `options.{args,command,commands}`
>
> The pre-pass **skips the rename when both `VITEST_MAX_THREADS` and `VITEST_MAX_FORKS` appear in the same file/scope** (they collapse to a single `VITEST_MAX_WORKERS` whose value depends on which pool the project uses — a decision the pre-pass can't make safely). It also **does not** edit CI provider configs (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `azure-pipelines.yml`, `.circleci/config.yml`, `bitbucket-pipelines.yml`) — YAML structure varies too much. Any conflicts and any CI matches are forwarded to you.
>
> **The cross-cutting changes below still require your attention** — pool option flattening (`singleThread`/`singleFork`, `maxThreads`/`maxForks`, `poolOptions.<pool>.{execArgv,isolate}`, `poolOptions.vmThreads.memoryLimit`), `test.deps.{external,inline,fallbackCJS}` → `test.server.deps.*` move, `test.{poolMatchGlobs,environmentMatchGlobs}` projects rewrite, browser provider function-form rewrite, `browser.testerScripts` → `testerHtmlPath`, `vitest.workspace.*` file inlining + `defineWorkspace` removal, custom reporter callback API updates, and `@vitest/browser` package replacement with per-provider packages.
>
> If a "Files modified by the generator phase" section appears in the prompt above, those files received the items the pre-pass handled — verify the new shape is in place before re-applying. If a "Context from the generator phase" section appears, **every entry there is pending work** the pre-pass detected but could not safely complete: address each one in addition to the relevant section below. A workspace-wide reminder is also emitted as a post-run "next step" about env vars set in CI provider dashboards — those can't be detected from the workspace tree.

## Prerequisites

Vitest 4 has hard runtime requirements. Verify these BEFORE editing any config:

- **Vite ≥ 6.0.0** (Vite 5 is unsupported). Check with `npx vite --version`. If on Vite 5, apply the Vite 6 / 7 / 8 migration guides first.
- **Node.js ≥ 20.0.0** (Node 18 support dropped). Check with `node --version`. Update CI `actions/setup-node` versions, `.nvmrc`, `engines` in `package.json`, and Docker base images.

If either prerequisite is unmet, **stop and resolve them before continuing** — config-level migration on an unsupported runtime will produce confusing errors.

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
- [ ] Inline any external `vitest.workspace.*` content into `test.projects` and delete the workspace file (external file references are no longer supported).
- [ ] If projects need different pool/environment options, set them inside each project entry rather than via the (now-removed) `poolMatchGlobs` / `environmentMatchGlobs` — see section 1.5.

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

### 1. Run Tests Per Project

```bash
# Test each project individually
nx run-many -t test -p PROJECT_NAME
```

### 2. Run All Tests

```bash
# Run tests across all affected projects
nx affected -t test
```

### 3. Check Coverage

```bash
# Verify coverage generation works with new config
nx affected -t test --coverage
```

### 4. Validate CI Pipeline

```bash
# Run full CI validation
nx prepush
```

### 5. Review Migration Checklist

- [ ] All configuration files updated
- [ ] All test files pass
- [ ] Coverage reports generate correctly
- [ ] CI/CD pipeline runs successfully
- [ ] Environment variables updated
- [ ] Documentation updated
- [ ] No deprecated API warnings in console

## Common Issues and Solutions

### Issue: Coverage includes too many files

**Solution**: Add explicit `coverage.include` patterns to match your source files

### Issue: Tests fail with "arrow function constructors not supported"

**Solution**: Convert arrow functions used as constructors to `function` keyword or `class` syntax

### Issue: Automocks not resetting between tests

**Solution**: Use `vi.unmock()` or `vi.resetModules()` instead of `vi.restoreAllMocks()`

### Issue: Mock call order assertions failing

**Solution**: Update to 1-based indexing for `invocationCallOrder`

### Issue: Browser tests failing after upgrade

**Solution**: Check browser provider is object format and imports use `vitest/browser`

### Issue: TypeScript errors in test files

**Solution**: Update to new type definitions and remove usage of deprecated types

## Files to Review

Create a checklist of all files that need review:

```bash
# Configuration files
find . -name "vitest.config.*" -o -name "vitest.workspace.*"
find . -name "project.json" -exec grep -l "vitest" {} \;

# Test files
find . -name "*.spec.*" -o -name "*.test.*"

# Files with mock usage
rg "vi\.(fn|spyOn|mock|restoreAllMocks)" --type ts --type tsx --type js

# Files with coverage config
rg "coverage\.(all|extensions|ignoreEmptyLines)" --type ts --type js

# CI configuration
find . -name ".github/workflows/*.yml" -o -name ".gitlab-ci.yml" -o -name "azure-pipelines.yml"
```

## Migration Strategy for Large Workspaces

1. **Migrate in phases**: Start with a small project, validate, then expand
2. **Use feature branches**: Create separate branches for different migration aspects
3. **Run tests frequently**: After each configuration change, run affected tests
4. **Document issues**: Keep track of project-specific issues and solutions
5. **Automate where possible**: Create codemods for repetitive changes

## Useful Commands During Migration

```bash
# Find all vitest configurations
nx show projects --with-target test

# Test specific project after changes
nx test PROJECT_NAME

# Test all affected
nx affected -t test

# View project details
nx show project PROJECT_NAME --web

# Clear Nx cache if needed
nx reset
```

## Guard Rails

DO NOT

- Force tests to pass by removing test logic and replacing it with `expect(true).toBe(true)`
- Remove assertions
- Add additional mocks that force tests to pass

---

## Notes for LLM Execution

When executing this migration:

1. **Work systematically**: Complete one category before moving to the next
2. **Test after each change**: Don't batch all changes without validation
3. **Keep user informed**: Report progress through each section
4. **Handle errors promptly**: If tests fail, fix immediately before proceeding
5. **Update documentation**: Note any workspace-specific patterns or issues
6. **Create meaningful commits**: Group related changes together with clear messages
7. **Use TodoWrite tool**: Track migration progress for visibility
