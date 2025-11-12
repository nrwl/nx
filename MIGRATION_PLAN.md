# Local Dist Build Architecture Migration Plan

## Overview

This document tracks the progress of migrating all packages from building to centralized `dist/packages/{name}` to local `{projectRoot}/dist`, enabling direct publishing from package directories with proper ES module support.

## Progress Summary

### ✅ Phase 1: Foundation & Global Configuration (COMPLETE)

#### 1.1 tsconfig.base.json

- ✅ Added `customConditions: ["@nx/nx-source"]` to compilerOptions
- This enables TypeScript to recognize our custom export condition for source imports during development

#### 1.2 nx.json Global Targets

Updated 4 target definitions:

- ✅ `legacy-post-build` outputs: `{workspaceRoot}/dist/packages/{projectName}` → `{projectRoot}/dist`
- ✅ `cleanup-tsconfig` command: `dist/packages/{projectName}` → `{projectRoot}/dist`
- ✅ `nx-release-publish` packageRoot: `dist/packages/{projectName}` → `{projectRoot}`
- ✅ `release.version.manifestRootsToUpdate`: `["dist/packages/{projectName}"]` → `["{projectRoot}"]`

#### 1.3 Scripts (6 files updated)

- ✅ `scripts/nx-release.ts` - Updated hackFixForDevkitPeerDependencies()
- ✅ `scripts/copy-readme.js` - Changed output path
- ✅ `scripts/update-package-group.js` - Updated workspace package path
- ✅ `scripts/cleanup-tsconfig-files.js` - Now accepts path argument, adjusted glob patterns
- ✅ `scripts/copy-graph-client.js` - Updated graph client destination
- ✅ `scripts/add-dependency-to-build.js` - Updated package.json path

### ✅ Phase 2: Per-Package TypeScript Configuration (COMPLETE)

#### 2.1 tsconfig.lib.json (40 packages)

All packages updated with:

- ✅ `outDir: "./dist"` (was `../../dist/packages/{name}`)
- ✅ `tsBuildInfoFile: "./dist/tsconfig.tsbuildinfo"`
- ✅ `moduleResolution: "nodenext"` (enables ES modules with exports)
- ✅ `module: "nodenext"` (output ES modules)

Migration script: `scripts/migrate-tsconfig-lib.js`

#### 2.2 tsconfig.json (40 packages)

- ✅ Added reference to `./tsconfig.spec.json` in 34 packages (6 already had it)
- Enables spec files to use nodenext moduleResolution

Migration script: `scripts/migrate-tsconfig-json.js`

#### 2.3 project.json (38 packages)

- ✅ Updated all build target outputs from `{workspaceRoot}/dist/packages/{name}` to `{projectRoot}/dist`
- ✅ Updated packageRoot in nx-release-publish targets (gradle, storybook)
- ✅ Special handling for @nx/nx native-packages copy commands

Migration script: `scripts/migrate-project-json.js`

---

## 🚧 Phase 3: Package Metadata & Structure (REMAINING)

### 3.1 Add .npmignore Files (40 packages)

**Status**: Not Started

**Template** (based on angular-rspack pattern):

```
!dist
dist/tsconfig.lib.tsbuildinfo
.eslintrc.json
project.json
tsconfig.json
tsconfig.lib.json
tsconfig.spec.json
jest.config.cts
vitest*.config.*
src/**/*.ts
!src/**/*.d.ts
**/*.spec.ts
**/*.test.ts
mocks/
test-utils/
readme-template.md
```

**Special cases**:

- `@nx/nx`: Keep existing `.npmignore` with native-packages exclusions
- `@nx/angular-rspack` and `@nx/angular-rspack-compiler`: Already have .npmignore

**Implementation**: Create script `scripts/create-npmignore-files.js`

### 3.2 Create readme-template.md (35 packages need them)

**Status**: Not Started

**Pattern**: Follow `packages/maven/readme-template.md`

```markdown
# @nx/{package-name}

{{links}}

{{content}}

{{resources}}
```

**Packages that already have it**:

- maven
- angular-rspack
- angular-rspack-compiler
- dotnet

**Implementation**: Create script `scripts/create-readme-templates.js`

### 3.3 Update package.json Exports Fields (CRITICAL - COMPLEX)

**Status**: ✅ COMPLETE

**Requirement**: Every import path must be explicitly exported with dual conditions:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts",
      "@nx/nx-source": "./src/index.ts"
    },
    "./path/to/utility": {
      "import": "./dist/path/to/utility.js",
      "types": "./dist/path/to/utility.d.ts",
      "@nx/nx-source": "./src/path/to/utility.ts"
    }
  }
}
```

**Packages WITH existing exports** (10 packages):

- angular
- docker
- dotnet
- gradle
- maven
- nuxt
- playwright
- react
- angular-rspack
- angular-rspack-compiler

**Action**: Update existing exports to add `@nx/nx-source` condition

**Packages WITHOUT exports** (30 packages):
Need to analyze ALL import patterns and create comprehensive exports.

**Critical packages with many deep imports**:

#### @nx/devkit (50+ deep import paths identified)

Core paths:

- `./testing` → testing utilities
- `./internal` → internal utilities
- `./internal-testing-utils` → internal testing
- `./src/generators/plugin-migrations/executor-to-plugin-migrator`
- `./src/generators/plugin-migrations/plugin-migration-utils`
- `./src/generators/executor-options-utils`
- `./src/generators/project-name-and-root-utils`
- `./src/generators/artifact-name-and-directory-utils`
- `./src/utils/add-plugin`
- `./src/utils/config-utils`
- `./src/utils/get-named-inputs`
- `./src/utils/calculate-hash-for-create-nodes`
- `./src/utils/replace-project-configuration-with-plugin`
- `./src/utils/string-utils`
- `./src/utils/catalog`
- `./src/utils/log-show-project-command`

**Full analysis needed** - search codebase for all `from '@nx/devkit/` patterns

#### @nx/js (50+ deep import paths identified)

Core paths:

- `./src/utils/typescript/ts-solution-setup`
- `./src/utils/typescript/ensure-typescript`
- `./src/utils/typescript/create-ts-config`
- `./src/utils/buildable-libs-utils`
- `./src/utils/assets/copy-assets-handler`
- `./src/internal`
- `./src/utils/find-npm-dependencies`
- `./src/utils/swc/add-swc-config`
- `./src/utils/swc/add-swc-dependencies`
- `./src/utils/package-json/get-npm-scope`
- `./src/utils/package-json/sort-fields`
- `./src/utils/get-import-path`
- `./src/utils/versions`
- `./src/plugins/typescript/util`
- `./src/plugins/rollup/type-definitions`
- `./src/plugins/jest/local-registry`

**Full analysis needed** - search codebase for all `from '@nx/js/` patterns

#### Other packages

Each of the remaining 28 packages needs analysis for deep imports:

- webpack, vite, rollup, rspack, esbuild (build tool packages)
- react, angular, vue, next, nest, express, node (framework packages)
- jest, cypress, playwright, storybook (testing packages)
- eslint, eslint-plugin (linting packages)
- Others

**Implementation Strategy**:

1. Create script to scan codebase: `scripts/analyze-deep-imports.js`
   - Find all `from '@nx/{package}/` import patterns
   - Group by package
   - Output JSON report
2. Create script to generate exports: `scripts/generate-package-exports.js`
   - Read analysis report
   - Generate exports object for each package
   - Add `@nx/nx-source` condition
   - Preserve existing metadata JSON exports (migrations.json, generators.json, executors.json)
3. Manually review and adjust exports for each package

**Estimated effort**: 4-6 hours

**✅ COMPLETED WORK**:

1. ✅ Created `scripts/generate-package-exports.js` - Automated script to generate exports fields
2. ✅ Updated all 40 packages with proper exports fields including:
   - Root export `"."` with import/types/@nx/nx-source conditions
   - package.json export
   - Metadata JSON exports (migrations.json, generators.json, executors.json)
   - Root-level entry points (testing, internal, etc.)
   - Wildcard patterns for deep imports (./src/utils/_, ./src/generators/_, etc.)
3. ✅ Merged with existing exports in 10 packages that already had exports configured
4. ✅ All exports now include the `@nx/nx-source` custom condition for development

**Actual effort**: ~3 hours

**Next Step**: Phase 4.1 - Add .js extensions to relative imports (build currently fails due to missing extensions)

### 3.4 Move Root-Level Entry Points into src/

**Status**: Not Started

**Affected packages**:

- `@nx/devkit`:
  - `testing.ts` → `src/testing.ts`
  - `internal.ts` → `src/internal.ts`
  - `internal-testing-utils.ts` → `src/internal-testing-utils.ts`

**Action**:

1. Move files to src/
2. Update exports to point to dist location:

```json
{
  "exports": {
    "./testing": {
      "import": "./dist/testing.js",
      "types": "./dist/testing.d.ts",
      "@nx/nx-source": "./src/testing.ts"
    }
  }
}
```

**Check for other packages** with root-level .ts entry points

### 3.5 Update Metadata JSON Files Paths

**Status**: Not Started

**Files to update** (in ~40 packages):

- `migrations.json`
- `generators.json`
- `executors.json`

**Change required**:

```json
{
  "generators": {
    "init": {
      "factory": "./dist/src/generators/init/init", // ADD dist/ prefix
      "schema": "./dist/src/generators/init/schema.json" // ADD dist/ prefix
    }
  }
}
```

**Note**: Schema.json files will be in dist because they're copied by legacy-post-build

**Implementation**: Create script `scripts/update-metadata-json-paths.js`

- Read each metadata JSON file
- Prepend `./dist` to all `factory`, `implementation`, and `schema` paths
- Preserve other fields

**Estimated effort**: 1 hour

---

## 🚧 Phase 4: Import Path Updates (REMAINING)

### 4.1 Add .js Extensions to ALL Relative Imports

**Status**: Not Started

**Requirement**: With `moduleResolution: nodenext`, ALL relative imports need `.js` extensions

**Pattern changes needed**:

```typescript
// Before
import { helper } from './utils';
import { config } from '../config';

// After
import { helper } from './utils.js';
import { config } from '../config.js';
```

**Scope**:

- Estimated 2000-3000 import statements across all packages
- Must handle:
  - Single quotes: `from './utils'` → `from './utils.js'`
  - Double quotes: `from "./utils"` → `from "./utils.js"`
  - Nested paths: `from '../utils/helper'` → `from '../utils/helper.js'`
  - Already has extension: `from './utils.js'` → no change
  - Deep paths: `from '../../shared/utils'` → `from '../../shared/utils.js'`

**Critical packages** (most imports):

- @nx/nx - ~100+ files with imports
- @nx/angular - ~150+ files
- @nx/js - ~80+ files
- @nx/react - ~70+ files
- @nx/devkit - ~50+ files
- All other packages - 20-50 files each

**Implementation Strategy**:

1. Use find/replace with careful validation
2. Regex pattern: `from ['"](\.\.[\/\\]|\.[\/\\])[^'"]+(?<!\.js)['"]`
3. Process package by package
4. Run TypeScript compiler after each package to catch errors

**Alternative**: Create AST-based codemod using ts-morph or jscodeshift

**Estimated effort**: 6-8 hours (manual) or 3-4 hours (codemod)

### 4.2 Validate Import Resolution

**Action**: After adding .js extensions, run:

```bash
pnpm nx run-many -t typecheck --all
```

Fix any:

- Missing .js extensions
- Incorrect paths
- Circular dependencies
- Module resolution failures

---

## 🚧 Phase 5: Special Package Handling (REMAINING)

### 5.1 @nx/nx Package

**Status**: Partially Complete

**Special requirements**:

- ✅ Native Rust bindings built to `src/native/`
- ✅ WASM builds
- ⚠️ Native-packages subdirectories (left unchanged per decision - verify they work)
- ✅ Graph-client build embedded

**Remaining**:

- Verify native build outputs (`src/native/*.node`, `src/native/*.wasm`) are included in npm package
- Test that `copy-native-package-directories` target works correctly
- Ensure .npmignore includes native artifacts correctly

### 5.2 @nx/angular Package

**Status**: Not Started

**Uses ng-packagr**:

Update `ng-package.json`:

```json
{
  "dest": "./dist", // was: ../../dist/packages/angular
  "deleteDestPath": false
}
```

Update `project.json` `build-ng` target if needed to output to local dist

**Verify**: ng-packagr respects new dest path and creates proper package structure

### 5.3 @nx/dotnet, @nx/maven, @nx/gradle

**Status**: Not Started

**Have native build processes**:

These already have custom `nx.release.version.manifestRootsToUpdate` pointing to their package roots.

**Verify**:

1. Their build processes output to local `dist/`
2. Their special build artifacts are included properly:
   - .NET analyzer compilation
   - Java/Kotlin builds (gradle)
   - Maven plugin build
3. Build dependencies work correctly

### 5.4 @nx/angular-rspack & @nx/angular-rspack-compiler

**Status**: Already Using Local Dist

**Action**:

- Verify their pattern is consistent with our new approach
- Ensure they work with new moduleResolution

---

## 🚧 Phase 6: Testing & Validation (REMAINING)

### 6.1 Build Verification

```bash
# Build all packages
pnpm nx run-many -t build --all

# Verify outputs exist in local dist folders
ls packages/*/dist/package.json
```

**Expected**: All packages build successfully to local dist/

### 6.2 TypeScript Compilation

```bash
# Run typecheck on all packages
pnpm nx run-many -t typecheck --all
```

**Expected**: No TypeScript errors, all module resolutions work

### 6.3 Unit Tests

```bash
# Run all unit tests
pnpm nx run-many -t test --all
```

**Expected**: All unit tests pass

### 6.4 Local Publishing Test

```bash
# Clear local registry
pnpm nx-release minor --local --clearLocalRegistry

# Publish to local registry
pnpm nx-release minor --local
```

**Verify**:

- Packages published from local dist folders
- Check published package structure in local registry
- Test creating new workspace with published packages
- Verify imports work in test project

### 6.5 E2E Tests

```bash
# Run affected e2e tests
pnpm nx affected -t e2e-local
```

**Expected**: All e2e tests pass

### 6.6 Deep Import Validation

Create test script to verify all known deep imports work:

```typescript
// Test all critical deep imports
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addPlugin } from '@nx/devkit/src/utils/add-plugin';
import { tsQuery } from '@nx/js/src/utils/typescript/ts-solution-setup';
// ... test all 100+ identified deep import patterns
```

---

## 📋 Execution Checklist for Next Session

### High Priority (Must Do)

- [ ] 3.3: Analyze and generate exports fields for all packages
- [ ] 3.5: Update metadata JSON file paths
- [ ] 4.1: Add .js extensions to all relative imports
- [ ] 6.1: Build verification

### Medium Priority (Should Do)

- [ ] 3.1: Create .npmignore files
- [ ] 3.2: Create readme-template.md files
- [ ] 3.4: Move root-level entry points
- [ ] 5.2: Update @nx/angular ng-package.json
- [ ] 6.2: TypeScript compilation check

### Lower Priority (Can Wait)

- [ ] 5.1: Verify @nx/nx native packages
- [ ] 5.3: Verify dotnet/maven/gradle builds
- [ ] 6.3-6.6: Full test suite

---

## Risk Assessment

### High Risk Items

1. **Exports field completeness**: Missing a single export = runtime error in production
2. **Module resolution with nodenext**: Behaves differently than node, may expose edge cases
3. **@nx/nx native bindings**: Complex build, easy to break
4. **Deep imports**: 100+ import paths must all be mapped correctly

### Mitigation Strategies

1. Create comprehensive analysis before generating exports
2. Test incrementally: exports → build → test → publish
3. Keep detailed notes of all changes
4. Maintain rollback plan (this is done on a feature branch)

### Rollback Plan

If critical issues found:

1. This work is on a feature branch - can be abandoned
2. Analyze what broke
3. Create minimal reproduction
4. Fix specific issue
5. Re-attempt migration

---

## Success Criteria

- ✅ All packages build to local `{projectRoot}/dist`
- ⬜ All packages have correct `exports` field with `@nx/nx-source` condition
- ⬜ All relative imports use `.js` extensions
- ✅ All packages use `moduleResolution: nodenext`
- ⬜ All metadata JSON files point to `dist/` paths
- ⬜ All 40 packages publish successfully from package root
- ⬜ All unit tests pass
- ⬜ All e2e tests pass
- ⬜ Local publishing works correctly
- ⬜ Deep imports resolve correctly
- ⬜ TypeScript compilation has no errors
- ⬜ No runtime errors when importing packages

---

## Time Estimates

**Completed** (Phases 1-2): ~4 hours
**Remaining**:

- Phase 3: 6-10 hours
- Phase 4: 6-8 hours
- Phase 5: 2-3 hours
- Phase 6: 3-4 hours

**Total Remaining**: 17-25 hours (2-3 working days)

---

## Notes

- Migration scripts created: `scripts/migrate-*.js` (can be deleted after migration)
- All changes are non-breaking for external consumers if done correctly
- Internal build process changes don't affect public APIs
- The `@nx/nx-source` custom condition enables better DX during monorepo development
