# Local Dist Migration Plan

This document provides a step-by-step plan to migrate Nx packages from the centralized `dist/packages/<package>` output to a local `packages/<package>/dist` structure.

## Background

**Based on commit:** `22af3940dd` (chore(core): write to local dist)

**Purpose:** Move package build outputs from `{workspaceRoot}/dist/packages/<package>` to `{projectRoot}/dist` for:

- Cleaner package structure
- Better TypeScript project references (enables `composite: true`)
- Improved developer experience
- Consistent package organization

## Prerequisites

Before starting, gather information about the target package:

1. **Package directory structure:**

   ```bash
   ls packages/<package>
   tree -L 2 packages/<package>/src  # if src exists
   ```

2. **Entry points:** Check what files are referenced in:

   - `package.json` (main, typings, bin)
   - `generators.json` (factory paths)
   - `executors.json` (implementation paths)
   - Root-level `.ts` files that export public APIs

3. **Special directories:** Note any non-standard directories like:
   - `presets/`, `plugins/`, `bin/`, `tasks-runners/`, `release/`
   - Template directories (e.g., `files/`, `files-*/`)
   - Native code directories

## Migration Steps

### Step 1: Update `tsconfig.lib.json`

**File:** `packages/<package>/tsconfig.lib.json`

**Changes:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist", // Changed from ../../dist/packages/<package>
    "rootDir": ".", // Added
    "declarationDir": ".", // Added
    "declarationMap": false, // Added (or true if desired)
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo", // Changed path
    "types": ["node"],
    "composite": true // Added - enables project references
  },
  "exclude": [
    "node_modules",
    "dist", // Added - don't compile output
    "**/*.spec.ts",
    "**/*_spec.ts",
    "**/*.test.ts",
    "jest.config.ts",
    "jest.config.cts",
    "**/__fixtures__/**/*.*", // Exclude test fixtures
    "**/__snapshots__/**/*.*" // Exclude test snapshots
  ],
  "include": [
    // IMPORTANT: This is an EXAMPLE. Your package's include array will be different!
    // Analyze your package structure and list ALL files that need compilation.
    // This is a precise inventory, not a template to copy.

    // Example patterns (customize based on YOUR package structure):
    "index.ts", // If root-level entry exists
    "src/**/*.ts", // If src directory exists
    "src/**/*.json", // If TypeScript needs to process JSON files
    "bin/**/*.ts", // If package has bin files
    "plugins/**/*.ts", // If package has plugins
    "presets/**/*.ts", // If package has presets
    "tasks-runners/**/*.ts", // If package has tasks-runners
    "package.json", // Usually include package.json
    "migrations.json", // If package has migrations
    "generators.json", // If package has generators
    "executors.json" // If package has executors
  ],
  "references": [
    // List package dependencies
    // Example:
    {
      "path": "../nx/tsconfig.lib.json"
    },
    {
      "path": "../devkit/tsconfig.lib.json"
    }
  ]
}
```

**Key decisions:**

- ✅ Do NOT add a `module` field - inherit `nodenext` from base tsconfig
- ✅ Set `composite: true` to enable project references
- ✅ **CRITICAL:** Include patterns are precise inventories specific to each package - analyze the actual package structure carefully:
  - List ALL TypeScript entry points at the root level (e.g., `index.ts`, `public-api.ts`, `internal.ts`)
  - Include all source directories that need compilation (e.g., `src/**/*.ts`, `bin/**/*.ts`, `plugins/**/*.ts`)
  - Include JSON files that TypeScript needs to process (e.g., `src/**/*.json`)
  - Include metadata files (e.g., `package.json`, `migrations.json`, `generators.json`, `executors.json`)
- ✅ Exclude test files, fixtures, snapshots, and the output directory (`dist`)

---

### Step 2: Create `.npmignore`

**File:** `packages/<package>/.npmignore`

**Template:**

```
# Build artifacts to exclude
dist/package.json
dist/migrations.json
dist/generators.json
dist/executors.json
dist/tsconfig.tsbuildinfo
dist/.eslintrc.json
dist/.babelrc

# Source files (exclude TS, but keep declarations)
**/*.ts
**/*.d.ts.map
!**/*.d.ts

# Test files and fixtures
src/**/__fixtures__/**
src/**/__snapshots__/**
src/**/*.snap
src/**/*.spec.ts
src/**/*.test.ts

# Configuration files
.eslintrc.json
.babelrc
jest.config.cts
jest.config.ts
tsconfig.json
tsconfig.*.json
project.json

# Other source artifacts
migrations.spec.ts
readme-template.md     # If exists

# Package-specific exclusions
# Add any package-specific files/directories here
```

---

### Step 3: Update `package.json`

**File:** `packages/<package>/package.json`

**Changes:**

1. **Update main entry point:**

   ```json
   "main": "./dist/index.js",     // Changed from ./index.js or ./src/index.js
   ```

2. **Update typings path** (declaration location depends on source file location):

   ```json
   "typings": "./index.d.ts",  // If index.ts is at package root
   // OR
   "typings": "./src/index.d.ts",  // If index.ts is at src/index.ts
   ```

   **Rule:** With `declarationDir: "."` and `rootDir: "."`, TypeScript preserves the directory structure:

   - Source at root (`index.ts`) → Declaration at root (`./index.d.ts`)
   - Source in subdirectory (`src/index.ts`) → Declaration in subdirectory (`./src/index.d.ts`)

3. **Update bin entries** (if package has CLI):

   ```json
   "bin": {
     "command-name": "./dist/bin/command.js"  // Changed from ./bin/command.js
   }
   ```

4. **Add exports field:**

   ```json
   "exports": {
     ".": {
       "import": "./dist/index.js",
       "types": "./index.d.ts",  // Match the source location (see Rule in step 2)
       "@nx/nx-source": "./index.ts"
     },
     "./package.json": "./package.json",
     "./migrations.json": "./migrations.json",  // If package has migrations
     "./generators.json": "./generators.json",  // If package has generators
     "./executors.json": "./executors.json"    // If package has executors
   }
   ```

5. **Add wildcard exports for subdirectories** (analyze package structure):

   **Purpose:** Allow users to import from subdirectories like `@nx/package/subdir/file`

   **IMPORTANT - Use both single-star and double-star patterns:**

   - Single-star (`*`) matches direct children: `./src/utils/file.ts`
   - Double-star (`**/*`) matches nested paths: `./src/utils/nested/deep/file.ts`
   - **Best practice:** Include BOTH patterns for directories that may contain nested subdirectories

   ```json
   {
     "exports": {
       // ... basic exports above ...

       // For bin/ directory (if exists)
       "./bin/*": {
         "import": "./dist/bin/*.js",
         "types": "./bin/*.d.ts",
         "@nx/nx-source": "./bin/*.ts"
       },

       // For plugins/ directory (if exists) - use both * and **/* for nested support
       "./plugins/*": {
         "import": "./dist/plugins/*.js",
         "types": "./plugins/*.d.ts",
         "@nx/nx-source": "./plugins/*.ts"
       },
       "./plugins/**/*": {
         "import": "./dist/plugins/**/*.js",
         "types": "./plugins/**/*.d.ts",
         "@nx/nx-source": "./plugins/**/*.ts"
       },

       // For presets/ directory (if exists)
       "./presets/*": {
         "import": "./dist/presets/*.js",
         "types": "./presets/*.d.ts",
         "@nx/nx-source": "./presets/*.ts"
       },

       // For tasks-runners/ directory (if exists)
       "./tasks-runners/*": {
         "import": "./dist/tasks-runners/*.js",
         "types": "./tasks-runners/*.d.ts",
         "@nx/nx-source": "./tasks-runners/*.ts"
       },

       // For src/ subdirectories - IMPORTANT: dist preserves src/ folder structure!
       // Use BOTH * and **/* patterns for comprehensive coverage
       "./src/generators/*": {
         "import": "./dist/src/generators/*.js", // Note: dist/src/**, not dist/**
         "types": "./src/generators/*.d.ts",
         "@nx/nx-source": "./src/generators/*.ts"
       },
       "./src/generators/**/*": {
         "import": "./dist/src/generators/**/*.js", // Handles deeply nested generators
         "types": "./src/generators/**/*.d.ts",
         "@nx/nx-source": "./src/generators/**/*.ts"
       },
       "./src/executors/*": {
         "import": "./dist/src/executors/*.js", // Note: dist/src/**, not dist/**
         "types": "./src/executors/*.d.ts",
         "@nx/nx-source": "./src/executors/*.ts"
       },
       "./src/executors/**/*": {
         "import": "./dist/src/executors/**/*.js", // Handles deeply nested executors
         "types": "./src/executors/**/*.d.ts",
         "@nx/nx-source": "./src/executors/**/*.ts"
       },
       "./src/utils/*": {
         "import": "./dist/src/utils/*.js", // Note: dist/src/**, not dist/**
         "types": "./src/utils/*.d.ts",
         "@nx/nx-source": "./src/utils/*.ts"
       },
       "./src/utils/**/*": {
         "import": "./dist/src/utils/**/*.js", // Handles deeply nested utilities
         "types": "./src/utils/**/*.d.ts",
         "@nx/nx-source": "./src/utils/**/*.ts"
       }

       // Add more based on actual package structure
     }
   }
   ```

   **Why both patterns?**

   - `./src/utils/*` covers: `@nx/package/src/utils/helper.ts`
   - `./src/utils/**/*` covers: `@nx/package/src/utils/nested/deep/helper.ts`
   - Together, they provide complete import coverage

6. **Add specific file exports for commonly imported utilities** (optional but recommended):

   **Purpose:** Some packages have frequently imported utility files that benefit from explicit exports

   **Example from @nx/nx:**

   ```json
   {
     "exports": {
       // ... basic and wildcard exports above ...

       // Commonly imported utilities
       "./src/devkit-exports": {
         "import": "./dist/src/devkit-exports.js", // Note: dist/src/**, not dist/**
         "types": "./src/devkit-exports.d.ts",
         "@nx/nx-source": "./src/devkit-exports.ts"
       },
       "./src/config/configuration": {
         "import": "./dist/src/config/configuration.js", // Note: dist/src/**, not dist/**
         "types": "./src/config/configuration.d.ts",
         "@nx/nx-source": "./src/config/configuration.ts"
       },
       "./src/utils/resolve-user-defined-nx-cloud-url": {
         "import": "./dist/src/utils/resolve-user-defined-nx-cloud-url.js", // Note: dist/src/**, not dist/**
         "types": "./src/utils/resolve-user-defined-nx-cloud-url.d.ts",
         "@nx/nx-source": "./src/utils/resolve-user-defined-nx-cloud-url.ts"
       }
       // ... more specific exports as needed
     }
   }
   ```

   **How to identify these:**

   - Search the codebase for imports like `import { something } from '@nx/package/src/specific/file'`
   - Check documentation for commonly referenced utilities
   - Review existing package usage patterns
   - Note: Wildcard exports will cover these, but specific exports provide better IDE support

**CRITICAL: Understanding the dist/src/** pattern:\*\*

With `declarationDir: "."` and `rootDir: "."` in tsconfig.lib.json, TypeScript **preserves the source directory structure** in the dist output:

- ✅ Source: `src/generators/foo/generator.ts` → JS: `dist/src/generators/foo/generator.js`
- ✅ Source: `bin/cli.ts` → JS: `dist/bin/cli.js` (root-level directories stay at root)

Therefore:

- Paths under `src/` must use `dist/src/**` in exports/generators/executors/migrations JSON
- Paths at package root (like `bin/`, `plugins/`) use `dist/**` directly

**Decision tree for exports:**

- ✅ **REQUIRED:** Check `generators.json` and `executors.json` for referenced paths
- ✅ **REQUIRED:** Check root-level TypeScript files for re-exports
- ✅ **REQUIRED:** Include any directories that users might import from
- ✅ **RECOMMENDED:** Look for common import patterns in the codebase and add specific exports
- ✅ **RECOMMENDED:** Search for existing imports to the package (e.g., `grep -r "from '@nx/package/"` in your codebase)

---

### Step 4: Update `executors.json`

**File:** `packages/<package>/executors.json`

**Change:** Update all `implementation` and `schema` paths from `./src/` to `./dist/src/`

**IMPORTANT:** Use `dist/src/**` not just `dist/**` - the src/ folder structure is preserved in dist output.

**Example:**

```json
{
  "executors": {
    "executor-name": {
      "implementation": "./dist/src/executors/executor-name/impl", // Changed from ./src/executors/
      "schema": "./dist/src/executors/executor-name/schema.json", // Changed from ./src/executors/
      "batchImplementation": "./dist/src/executors/executor-name/impl#batchFn",
      "description": "..."
    }
  }
}
```

**Search pattern:** Replace all `"./src/` with `"./dist/src/` in the file.

---

### Step 5: Update `generators.json`

**File:** `packages/<package>/generators.json`

**Change:** Update all `factory` and `schema` paths from `./src/` to `./dist/src/`

**IMPORTANT:** Use `dist/src/**` not just `dist/**` - the src/ folder structure is preserved in dist output.

**Example:**

```json
{
  "generators": {
    "generator-name": {
      "factory": "./dist/src/generators/generator-name/generator#generatorFn", // Changed from ./src/generators/
      "schema": "./dist/src/generators/generator-name/schema.json", // Changed from ./src/generators/
      "description": "..."
    }
  }
}
```

**Search pattern:** Replace all `"./src/` with `"./dist/src/` in the file.

---

### Step 6: Update `migrations.json`

**File:** `packages/<package>/migrations.json`

**Change:** Update all `implementation` paths from `./src/` to `./dist/src/`

**IMPORTANT:** Use `dist/src/**` not just `dist/**` - the src/ folder structure is preserved in dist output.

**Example:**

```json
{
  "generators": {
    "16.0.0-remove-nrwl-cli": {
      "implementation": "./dist/src/migrations/update-16-0-0/remove-nrwl-cli", // Changed from ./src/migrations/
      "description": "..."
    },
    "update-package-scripts": {
      "implementation": "./dist/src/migrations/update-15-0-0/update-package-scripts", // Changed from ./src/migrations/
      "description": "..."
    }
  }
}
```

**Search pattern:** Replace all `"./src/` with `"./dist/src/` in the file.

**Note:** Not all packages have a `migrations.json` file. Skip this step if the package doesn't have migrations.

---

### Step 7: Update `project.json`

**File:** `packages/<package>/project.json`

**Changes:**

1. **Update build target:**

**IMPORTANT:** The build target should use a simple `command` field, not `executor: "nx:run-commands"` with nested `options.commands`. This standardized pattern is cleaner and more maintainable.

```json
{
  "build": {
    "inputs": [
      "production",
      "^production",
      "{workspaceRoot}/scripts/copy-readme.js",
      "{projectRoot}/readme-template.md"
    ],
    "outputs": [
      "{projectRoot}/dist/**/*.{js,mjs,cjs}", // Changed from {workspaceRoot}/dist/packages/<package>
      "{projectRoot}/README.md"
    ],
    "command": "node ./scripts/copy-readme.js <package> packages/<package>/readme-template.md packages/<package>/README.md"
  }
}
```

**Note:** Some packages may have additional dependencies in `dependsOn` (like `"build-base"`, `"legacy-post-build"`). Preserve these when updating the build target.

**Example with additional dependencies:**

```json
{
  "build": {
    "dependsOn": ["^build", "build-base", "legacy-post-build"],
    "inputs": [
      "production",
      "^production",
      "{workspaceRoot}/scripts/copy-readme.js",
      "{projectRoot}/readme-template.md"
    ],
    "outputs": [
      "{projectRoot}/dist/**/*.{js,mjs,cjs}",
      "{projectRoot}/README.md"
    ],
    "command": "node ./scripts/copy-readme.js <package> packages/<package>/readme-template.md packages/<package>/README.md"
  }
}
```

2. **Update legacy-post-build target** (if exists):

```json
{
  "legacy-post-build": {
    "executor": "@nx/workspace-plugin:legacy-post-build",
    "outputs": ["{projectRoot}/dist"], // Added - helps Nx track build artifacts for caching
    "options": {
      "main": "./index.js", // Or "./bin/nx.js" for CLI packages - matches actual entry point
      "types": "./index.d.ts", // Or "./bin/nx.d.ts" - matches where declarations are
      "tsConfig": "./tsconfig.lib.json",
      "outputPath": "./dist", // Changed from ../../dist/packages/<package>
      "sourceRoot": "./src", // Added (if package has src directory)
      "replaceSrcRoot": true, // OPTIONAL - only needed if assets reference 'src' in paths
      "assets": [
        // Copy template files
        {
          "input": "packages/<package>",
          "glob": "**/files/**",
          "output": "/"
        },
        // Copy JSON schemas (but exclude configs)
        {
          "input": "packages/<package>",
          "glob": "**/*.json",
          "ignore": [
            "**/tsconfig*.json",
            "project.json",
            ".eslintrc.json",
            "executors.json", // Exclude - stays at root
            "generators.json", // Exclude - stays at root
            "migrations.json", // Exclude - stays at root
            "package.json" // Exclude - stays at root
          ],
          "output": "/"
        },
        // Copy static assets
        {
          "input": "packages/<package>",
          "glob": "**/*.{js,mjs,cjs,css,html,svg}",
          "ignore": ["**/jest.config.js"],
          "output": "/"
        }
        // Remove the "**/*.d.ts" asset copy - declarations handled by tsc
        // Keep LICENSE asset if the package needs it distributed (check existing config)
      ]
    }
  }
}
```

**Key changes:**

- `outputs`: `["{projectRoot}/dist"]` - Added to help Nx track build artifacts for caching
- `outputPath`: `"./dist"` instead of `"../../dist/packages/<package>"`
- `sourceRoot`: `"./src"` if the package has a src directory
- `replaceSrcRoot: true` - **OPTIONAL**: Only add this if you have assets that reference `src/` in their paths and you want them at the root of dist. Not all packages need this.
- `main` and `types`: Should point to the actual entry point location:
  - Most packages: `"main": "./index.js"`, `"types": "./index.d.ts"`
  - CLI packages: `"main": "./bin/nx.js"`, `"types": "./bin/nx.d.ts"`
  - **IMPORTANT:** These point to source locations, NOT dist output - this tells the build system where declarations will be generated
- Asset `input` paths: You have two options:
  - **Standard approach:** `"input": "packages/<package>"` with extensive ignore lists (shown above)
- Exclude JSON config files from assets (they stay at package root)
- Remove manual `.d.ts` copying (TypeScript handles this)
- Keep LICENSE asset if the package distributes it (check existing configuration)

---

### Step 8: Update Source Files for ESM Compatibility

**Purpose:** ESM compatibility may require source file changes when building to a separate dist folder.

#### A. Add `.js` Extensions to Dynamic Imports (if needed)

**Search for patterns:**

```bash
# Search for dynamic imports with relative paths
grep -r "import(.*['\"]\./" packages/<package>/src --include="*.ts"

# Search for await import()
grep -r "await import(" packages/<package>/src --include="*.ts"
```

**Update pattern (if relative dynamic imports are found):**

- `import('./module')` → `import('./module.js')`
- `import('../utils')` → `import('../utils.js')`
- `await import('./path')` → `await import('./path.js')`

**Files to check:**

- Command files (if package has CLI)
- Plugin files
- Any files with dynamic imports

**Note:** Static imports don't need `.js` extensions; TypeScript handles those. Not all packages will have dynamic imports that need this change.

#### B. Fix Import Styles for ESM

**Purpose:** Some packages may use CommonJS-style imports that need to be updated for proper ESM compatibility.

**Common patterns to fix:**

```typescript
// ❌ CommonJS-style namespace import (may cause issues with ESM)
import * as detectPort from 'detect-port';

// ✅ ESM default import
import detectPort from 'detect-port';
```

**How to identify:**

1. Look for `import * as` statements that import packages with default exports
2. Check if the package you're importing is ESM-native
3. Review the package's documentation for recommended import style

**Search for patterns:**

```bash
# Find potential namespace imports
grep -r "import \* as" packages/<package>/src --include="*.ts"
```

**Example from @nx/js migration:**

```typescript
// Before: packages/js/src/executors/verdaccio/verdaccio.impl.ts
import * as detectPort from 'detect-port';

// After:
import detectPort from 'detect-port';
```

#### C. Type Assertions (if needed)

In rare cases, the new build configuration may affect TypeScript's type inference slightly. If you encounter type errors after migration where none existed before, you may need to add explicit type assertions:

```typescript
// Example: Adding explicit type cast
const config = getConfig();
processConfig(config as ConfigType); // Type assertion may be needed

// Or with imported types
import type { PackageJson } from './types';
const pkg = readPackageJson();
usePackage(pkg as PackageJson); // Explicit cast
```

This is uncommon but can occur when using `declarationDir: "."` with `rootDir: "."`. If type errors appear, check if an explicit type assertion resolves the issue.

#### Summary Checklist:

- [ ] Search for relative dynamic imports and add `.js` extensions if found
- [ ] Review `import * as` statements and fix to use default imports where appropriate
- [ ] Test that imports resolve correctly after changes
- [ ] Address any type inference issues with explicit assertions (rare)

---

### Step 9: Create `readme-template.md`

**File:** `packages/<package>/readme-template.md`

**IMPORTANT:** This step is required for the standardized build target configuration (Step 7) to work correctly. The build target references `{projectRoot}/readme-template.md` in its inputs and uses it to generate the final README.md.

**Create the template file:**

```bash
cp packages/<package>/README.md packages/<package>/readme-template.md
```

**Purpose:**

- The `readme-template.md` file serves as the source for the package's README
- The build script (`scripts/copy-readme.js`) processes this template to generate the final `README.md`
- The template can include placeholders (like `{{links}}` or `{{content}}`) that get replaced during the build
- This allows for automated README generation and consistency across packages

**After creating the file:**

- The `readme-template.md` should be committed to the repository
- The generated `README.md` will be created during the build process
- The `readme-template.md` is excluded from npm packages via `.npmignore` (see Step 2)

---

### Step 10: Update Root `.gitignore`

**File:** `.gitignore` (at workspace root)

**Change:** Add pattern to exclude declaration source map files

**Add the following line:**

```
packages/**/*.d.ts.map
```

**Purpose:** Declaration source map files (`.d.ts.map`) are generated during compilation and should not be tracked in version control. These files map TypeScript declaration files back to their source, but are not needed in the repository.

**Location:** Add this line in the section where package outputs are ignored, typically near other `packages/` or `dist/` patterns.

---

## Verification Steps

After making all changes, verify the migration:

### 1. Build the package

```bash
pnpm nx build <package>
```

**Expected results:**

- ✅ `packages/<package>/dist/` contains compiled JS files
- ✅ `.d.ts` files generated at package root
- ✅ No errors in TypeScript compilation

### 2. Check outputs

```bash
# Verify dist structure
ls -la packages/<package>/dist

# Verify declaration files at root
ls -la packages/<package>/*.d.ts

# Verify template files copied (if applicable)
ls -la packages/<package>/dist/**/files
```

### 3. Run tests

```bash
# Test the specific package
pnpm nx run-many -t test,build,lint -p <package>

# Test affected projects
pnpm nx affected -t build,test,lint
```

### 4. Type-check

```bash
# Verify TypeScript compilation
pnpm nx typecheck <package>
```

### 5. Run E2E tests (if applicable)

```bash
pnpm nx affected -t e2e-local
```

---

## Common Issues & Solutions

### Issue: "Option 'module' must be set to 'NodeNext'"

**Cause:** Package dependencies haven't been migrated yet.

**Solution:** Migrate dependencies first (topological order: nx → devkit → other packages).

---

### Issue: "Cannot find module" errors

**Cause:** Missing `.js` extensions in dynamic imports.

**Solution:** Search for and update dynamic imports:

```bash
grep -r "import(.*['\"]\./" packages/<package> --include="*.ts"
```

---

### Issue: Missing files in dist output

**Cause:** Files not included in `tsconfig.lib.json` or assets not copied in `project.json`.

**Solution:**

1. Check `tsconfig.lib.json` includes array
2. Verify `project.json` assets configuration
3. Ensure files aren't in exclude list

---

### Issue: Declaration files in wrong location

**Cause:** `declarationDir` not set correctly.

**Solution:** Ensure `declarationDir: "."` in `tsconfig.lib.json`

---

## Package-Specific Considerations

### Packages with Native Code (like `@nx/nx`)

Packages that include Rust or other native code require special handling:

**1. .npmignore patterns** - Add extensive exclusions for native build artifacts:

```
# Native build artifacts
dist/native-packages
native-packages/**/*.*
**/*.rs
**/*.node  # Built .node files (usually already in .gitignore)
**/*.debug.wasm32-wasi.wasm
build.rs
Cargo.toml
src/native/*.js
src/native/*.node
src/native/CLAUDE.md
```

**2. Manual TypeScript declaration files** - Create `.d.ts` stubs for TypeScript wrappers around native code:

When you have TypeScript files that import native bindings (`.node` files), you may need to create manual declaration files:

```typescript
// src/native/assert-supported-platform.d.ts
export declare function assertSupportedPlatform(): void;

// src/native/native-file-cache-location.d.ts
export declare function getNativeFileCacheLocation(): string;

// src/native/transform-objects.d.ts
export declare function transformObject<T>(input: T): T;
```

**Why?** TypeScript may not automatically generate declarations for files that dynamically import native bindings. Manual `.d.ts` files ensure proper type information.

**3. Additional considerations:**

- Keep `.node` and `.wasm` files in assets (if they're distributed)
- Copy `native-packages/` directory structure if needed for distribution
- Verify native bindings work after migration by running build and tests

### Packages with CLI (bin files)

- Update `package.json` bin paths
- Add `.js` extensions to imports in bin files
- Add `bin/*` exports to package.json

### Packages with Plugins

- Add `plugins/*` exports to package.json
- Ensure plugin files are in tsconfig includes
- Copy any plugin schemas/configs

---

## Migration Order

Migrate packages in dependency order (topological sort):

1. **@nx/nx** ✅ (done - commit `22af3940dd`)
2. **@nx/devkit** ✅ (done - commit `1688ab2aae`)
3. **@nx/workspace** ✅ (done - commit `1688ab2aae`)
4. **@nx/js** ✅ (done - commit `f5ae5b4bbf`)
5. **Other packages** (check their dependencies)

**To determine order:**

```bash
pnpm nx graph --file=graph.json
# Check dependencies in package.json files
```

---

## Quick Reference Checklist

Use this checklist when migrating a package:

- [ ] Analyze package structure (directories, entry points, special files)
- [ ] Update `tsconfig.lib.json` (outDir, rootDir, composite, includes - precise inventory!)
- [ ] Create `.npmignore`
- [ ] Update `package.json` (main, typings, bin, exports - check declaration locations!)
- [ ] Update `executors.json` (./src/ → ./dist/)
- [ ] Update `generators.json` (./src/ → ./dist/)
- [ ] Update `migrations.json` (./src/ → ./dist/) - if package has migrations
- [ ] Update `project.json` (build target with standardized inputs/outputs/command, legacy-post-build outputs field, asset inputs, replaceSrcRoot if needed)
- [ ] Update source files for ESM compatibility (dynamic imports, import styles)
- [ ] Create `readme-template.md` (required for standardized build target)
- [ ] Update root `.gitignore` to exclude `packages/**/*.d.ts.map`
- [ ] For native packages: Create manual `.d.ts` files for native wrappers
- [ ] Build package: `pnpm nx build <package>`
- [ ] Verify outputs: `ls packages/<package>/dist`
- [ ] Run tests: `pnpm nx run-many -t test,build,lint -p <package>`
- [ ] Run affected: `pnpm nx affected -t build,test,lint`
- [ ] Commit changes with conventional commit format

---

## Example Commands for Future Sessions

To apply this plan in a future session:

```
Apply the local dist migration plan from docs/local-dist-migration-plan.md to package <packageName>
```

Or more specifically:

```
Migrate @nx/<packageName> to use local dist output following the plan in docs/local-dist-migration-plan.md
```

---

**Document Version:** 2.3
**Last Updated:** 2025-01-17
**Based on Commits:**

- `22af3940dd` (chore(core): write to local dist)
- `1688ab2aae` (chore(core): build devkit and workspace to local dist)
- `f5ae5b4bbf` (chore(js): build to local dist)
- Current branch commits (standardizing build targets across packages)

**Changelog:**

- v2.3 (2025-01-17): Standardized build target configuration
  - **ENHANCED:** Step 7 now specifies using simple `command` field instead of `executor: "nx:run-commands"` with nested options
  - **ENHANCED:** Step 7 includes example showing how to preserve additional `dependsOn` dependencies
  - **REQUIRED:** Step 9 (Create readme-template.md) is now required (not optional) for standardized build target to work
  - **ENHANCED:** Step 9 now includes detailed explanation of purpose and importance
  - Updated checklist to reflect that readme-template.md is required and build target should use standardized pattern
- v2.2 (2025-01-17): Enhanced guidance based on @nx/js migration analysis
  - **NEW:** Added Step 7a - Alternative Asset Input Strategy for packages with assets primarily in src/
  - **ENHANCED:** Step 3 now recommends BOTH single-star (`*`) and double-star (`**/*`) wildcard patterns for comprehensive import coverage
  - **ENHANCED:** Step 7 now includes `outputs` field in legacy-post-build and clarifies asset input path options
  - **ENHANCED:** Step 8 expanded beyond `.js` extensions to include ESM import style fixes (e.g., `import * as` → `import`)
  - Added @nx/js to migration order (commit f5ae5b4bbf)
  - Updated checklist to reflect new guidance
  - Clarified that not all packages need `.js` extensions for dynamic imports
  - Added real-world example from @nx/js migration showing import style fixes
- v2.1 (2025-11-17): **CRITICAL CORRECTION** - Fixed dist path pattern
  - **BREAKING:** All paths in package.json exports, generators.json, executors.json, and migrations.json must use `dist/src/**` not `dist/**`
  - Added clear explanation that `declarationDir: "."` preserves src/ folder structure in dist
  - Updated all examples to show correct `dist/src/**` pattern for files under src/
  - Distinguished between root-level files (use `dist/**`) and src/ files (use `dist/src/**`)
  - This correction is essential - using `dist/**` instead of `dist/src/**` will cause runtime errors
- v2.0 (2025-11-17): Major update based on analysis of actual implementation
  - Added Step 6: Update migrations.json
  - Added Step 10: Update root .gitignore
  - Enhanced tsconfig.lib.json guidance (precise inventory emphasis)
  - Enhanced package.json exports guidance (specific file exports, declaration locations)
  - Enhanced project.json guidance (replaceSrcRoot optionality, main/types, LICENSE)
  - Added type assertion considerations for dynamic imports
  - Expanded Native/Rust packages section with manual .d.ts guidance
  - Updated migration order to mark @nx/devkit and @nx/workspace as complete
  - Enhanced checklist with new steps and clarifications
- v1.0 (2025-11-16): Initial version
