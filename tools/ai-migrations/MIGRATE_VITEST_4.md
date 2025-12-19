# Vitest 4.0 Migration Instructions for LLM

## Overview

These instructions guide you through migrating an Nx workspace containing multiple Vitest projects from Vitest 3.x to Vitest 4.0. Work systematically through each breaking change category.

## Pre-Migration Checklist

1. **Identify all Vitest projects**:

   ```bash
   nx show projects --with-target test
   ```

2. **Locate all Vitest configuration files**:
   - Search for `vitest.config.{ts,js,mjs}`
   - Search for `vitest.workspace.{ts,js,mjs}`
   - Check `project.json` files for inline Vitest configuration

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
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    maxThreads: 4,
    maxForks: 2,
    singleThread: false,
    poolOptions: {
      threads: {
        useAtomics: true,
      },
      vmThreads: {
        memoryLimit: '512MB',
      },
    },
  },
});

// ✅ AFTER (Vitest 4.0)
export default defineConfig({
  test: {
    maxWorkers: 4, // Consolidates maxThreads and maxForks
    isolate: true, // Replaces singleThread: false
    // Remove: poolOptions, threads.useAtomics
    vmMemoryLimit: '512MB', // Moved to top-level
  },
});
```

**Action Items**:

- [ ] Replace `maxThreads` and `maxForks` with single `maxWorkers` option
- [ ] Replace `singleThread: true` or `singleFork: true` with `maxWorkers: 1, isolate: false`
- [ ] Move all `poolOptions.*` nested options to top-level (e.g., `poolOptions.vmThreads.memoryLimit` → `vmMemoryLimit`)
- [ ] Remove `threads.useAtomics` option
- [ ] Update CI environment variables: `VITEST_MAX_THREADS` and `VITEST_MAX_FORKS` → `VITEST_MAX_WORKERS`

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

- [ ] Rename `workspace` property to `projects` in all config files
- [ ] Remove external workspace file references (must be inline in config)
- [ ] Update `poolMatchGlobs` to use `projects` pattern matching instead
- [ ] Update `environmentMatchGlobs` to use `projects` pattern matching instead

#### 1.4 Browser Configuration

**Search Pattern**: `browser.provider`, `browser.testerScripts`, imports from `@vitest/browser`

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright', // String value
      testerScripts: ['./setup.js'],
    },
  },
});

// Import changes
import { page } from '@vitest/browser';

// ✅ AFTER (Vitest 4.0)
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: { name: 'playwright' }, // Object value
      testerHtmlPath: './test-setup.html', // Renamed from testerScripts
    },
  },
});

// Import changes
import { page } from 'vitest/browser';
```

**Action Items**:

- [ ] Convert `browser.provider` string values to object format: `{ name: 'provider-name' }`
- [ ] Replace `browser.testerScripts` with `browser.testerHtmlPath`
- [ ] Update all imports from `@vitest/browser` to `vitest/browser`
- [ ] Remove `@vitest/browser` from dependencies if no longer needed

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

- [ ] Move `deps.*` options under `server.deps` namespace
- [ ] Remove `poolMatchGlobs` (use `projects` with conditions instead)
- [ ] Remove `environmentMatchGlobs` (use `projects` with conditions instead)

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

**Search Pattern**: `vi.mock()` with factory functions, `.mockRestore()` on automocks

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
vi.mock('./utils', () => ({
  get value() {
    return 42;
  }, // Would call getter
}));

import { value } from './utils';
console.log(value); // Would execute getter logic

// Restore might have worked
const spy = vi.spyOn(obj, 'method');
spy.mockRestore(); // Might work on automocks

// ✅ AFTER (Vitest 4.0)
vi.mock('./utils', () => ({
  get value() {
    return 42;
  },
}));

import { value } from './utils';
console.log(value); // Returns undefined (doesn't call getter)

// Explicitly return value if needed
vi.mock('./utils', () => ({
  value: 42, // Not a getter
}));

// mockRestore no longer works on automocks
const spy = vi.spyOn(obj, 'method');
spy.mockRestore(); // Throws error if method is automocked

// Use unmock instead
vi.unmock('./module');
```

**Action Items**:

- [ ] Convert automocked getters to plain property values where needed
- [ ] Remove `.mockRestore()` calls on automocked methods
- [ ] Use `vi.unmock()` to clear automocks instead
- [ ] Test instance method isolation (they now share state with prototype)

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

**Search Pattern**: Custom reporters, `onCollected`, `onTaskUpdate`, `onFinished`

**Changes Required**:

```typescript
// ❌ BEFORE (Vitest 3.x)
export default {
  onCollected(files) {
    // Handle collected files
  },
  onTaskUpdate(task) {
    // Handle task update
  },
  onFinished(files) {
    // Handle completion
  },
};

// ✅ AFTER (Vitest 4.0)
// Use new reporter API - consult Vitest 4 docs for replacement methods
```

**Action Items**:

- [ ] Review custom reporters for removed API usage
- [ ] Consult Vitest 4 documentation for new reporter API
- [ ] Update or rewrite custom reporters to use new APIs

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
    printShadowRoot: false,
  },
});
```

**Action Items**:

- [ ] Review snapshot tests for custom elements
- [ ] Update snapshots if shadow root contents are now included
- [ ] Add `printShadowRoot: false` if old behavior is required

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
