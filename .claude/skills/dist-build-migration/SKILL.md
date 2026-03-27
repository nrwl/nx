---
name: dist-build-migration
description: Migrate an Nx package to build to a local dist/ directory with nodenext module resolution, exports map, and @nx/nx-source condition.
allowed-tools: Bash, Read, Glob, Grep, Agent, Edit, Write
---

# Migrate Package to Local Dist Build

You are migrating an Nx monorepo package from building to `../../dist/packages/<name>` to building locally to `packages/<name>/dist/`. This matches the pattern already used by `nx` and `devkit`.

## Argument

The user provides a package name (e.g., `js`, `webpack`, `angular`). The package lives at `packages/<name>/`.

## Steps

### 1. Read current state

Read these files for the target package:

- `packages/<name>/package.json`
- `packages/<name>/project.json`
- `packages/<name>/tsconfig.lib.json`
- `packages/<name>/tsconfig.spec.json` (if exists)
- `packages/<name>/.eslintrc.json` (if exists)
- `packages/<name>/assets.json` (if exists)
- `packages/<name>/.npmignore` (if exists)
- `packages/<name>/.gitignore` (if exists)

Also read the reference implementations:

- `packages/devkit/tsconfig.lib.json`
- `packages/devkit/package.json`
- `packages/devkit/project.json`
- `packages/devkit/.npmignore`

Run `pnpm nx show target <name>:build-base` to see the inferred build target.
Run `pnpm nx show target <name>:build` to see the full build target.

### 2. Identify entry points

Look at the package's root `.ts` files and any existing `exports` field. Common entry points:

- `index.ts` (main)
- `testing.ts`
- `internal.ts`
- `ngcli-adapter.ts`
- Any other `.ts` files at the package root that re-export from `src/`

Also check for `migrations.json` and `generators.json`/`executors.json` — these need exports entries too.

### 3. Update `tsconfig.lib.json`

Transform from the old pattern to the new pattern:

**Before:**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "../../dist/packages/<name>",
    "tsBuildInfoFile": "../../dist/packages/<name>/tsconfig.tsbuildinfo"
  }
}
```

**After:**

```json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "declarationDir": "dist",
    "declarationMap": false,
    "tsBuildInfoFile": "dist/tsconfig.tsbuildinfo",
    "types": ["node"],
    "composite": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "exclude": ["node_modules", "dist", ...existing excludes, ".eslintrc.json"],
  "include": ["*.ts", "src/**/*.ts"]
}
```

**Important**: Adjust `include` based on the package's actual structure. If the package has directories like `bin/`, `plugins/`, etc. at the root level (like `nx` does), include those too.

### 4. Update `tsconfig.spec.json` (if exists)

Change `outDir` from `../../dist/packages/<name>/spec` to `dist/spec`.

### 5. Update `package.json`

Key changes:

- Add `"type": "commonjs"` near the top (after `private`)
- Remove `"main"` field (replaced by exports)
- Change `"types"` to `"./dist/index.d.ts"`
- Add `"exports"` map with entries for each entry point

Each export entry follows this pattern:

```json
"./entry-name": {
  "@nx/nx-source": "./entry-name.ts",
  "types": "./entry-name.d.ts",
  "default": "./dist/entry-name.js"
}
```

The main entry (`.`) uses `./index.ts`, `./index.d.ts`, `./dist/index.js`.

Always include:

```json
"./package.json": "./package.json"
```

Include `"./migrations.json": "./migrations.json"` if the package has migrations.

**Note**: The `@nx/nx-source` condition is a custom condition used for source-level resolution within the workspace (so other packages import from source, not dist).

### 6. Update `project.json`

Add these sections:

```json
{
  "release": {
    "version": {
      "generator": "@nx/js:release-version",
      "preserveLocalDependencyProtocols": true,
      "manifestRootsToUpdate": ["packages/{projectName}"]
    }
  },
  "targets": {
    "nx-release-publish": {
      "options": {
        "packageRoot": "packages/{projectName}"
      }
    },
    "build-base": {
      "outputs": [
        "{projectRoot}/dist/**/*.{js,cjs,mjs,d.ts}",
        "{projectRoot}/*.d.ts",
        "{projectRoot}/src/**/*.d.ts"
      ]
    }
  }
}
```

Update the existing `build` target's `outputs` if they reference `{workspaceRoot}/dist/packages/<name>` — they should now reference `{projectRoot}/dist/`.

Also update `dependsOn` in the `build` target: replace `"^build"` with `"^build"` if it isn't already, and make sure `"build-base"` is listed.

### 7. Update `.eslintrc.json`

Add `"dist"` and `"*.d.ts"` to `ignorePatterns`:

```json
"ignorePatterns": ["!**/*", "node_modules", "dist", "*.d.ts"]
```

### 8. Update `assets.json` (if exists)

Change `outDir` from `"dist/packages/<name>"` to `"packages/<name>/dist"`.

### 9. Create/update `.npmignore`

Create a `.npmignore` file (use devkit's as template):

```
node_modules/
.eslintrc.json
jest.config.cts
jest-resolver.js
migrations.spec.ts
project.json
tsconfig.json
tsconfig.lib.json
tsconfig.spec.json
dist/tsconfig.tsbuildinfo
**/*.ts
!**/*.d.ts
```

Add any package-specific files that shouldn't be published (test fixtures, etc.).

### 10. Rename README.md and update build command

If the package has a `README.md` at its root and uses the `copy-readme.js` script in its build target:

1. Rename `README.md` to `readme-template.md` (`git mv`)
2. Update the build command to pass explicit paths:
   ```
   node ./scripts/copy-readme.js <name> packages/<name>/readme-template.md packages/<name>/README.md
   ```
3. Update the build target `outputs` to `["{projectRoot}/README.md"]`

The script's default behavior reads `packages/<name>/README.md` and writes to `dist/packages/<name>/README.md` — both wrong for the new layout. Passing explicit args fixes both.

### 11. Update root `.gitignore`

Add two entries to the workspace root `.gitignore`:

1. Under the section that lists generated README files (look for `packages/nx/README.md`), add:

   ```
   packages/<name>/README.md
   ```

2. Under the section that lists generated `.d.ts` files (look for `packages/nx/**/*.d.ts`), add:
   ```
   packages/<name>/**/*.d.ts
   ```

These are build outputs that shouldn't be committed.

### 12. Update docs generation paths

Check `astro-docs/src/plugins/utils/` for any code that references `.d.ts` files from the package. The docs generation reads `.d.ts` entry points to build API reference pages. Paths that previously pointed to `dist/packages/<name>/foo.d.ts` (workspace root dist) or `packages/<name>/foo.d.ts` (package root) now need to point to `packages/<name>/dist/foo.d.ts`.

For example, `devkit-generation.ts` had to be updated to look for `packages/devkit/dist/index.d.ts` instead of `packages/devkit/index.d.ts`.

### 13. Update `scripts/nx-release.ts`

If the package has special release handling in `scripts/nx-release.ts` (like devkit's `hackFixForDevkitPeerDependencies`), update any paths from `./dist/packages/<name>/` to `./packages/<name>/`.

### 14. Update imports across the workspace

Search for imports from `@nx/<name>/src/` across all other packages. These internal imports need to be updated:

- If the imported thing is re-exported through a public entry point (index.ts, internal.ts, etc.), update the import to use that entry point
- If not, consider adding it to `internal.ts` or the appropriate entry point

Use: `grep -r "from '@nx/<name>/src/" packages/ --include="*.ts" -l` to find affected files.

Also check for imports in:

- `e2e/` tests
- `scripts/`
- `tools/workspace-plugin/`
- `astro-docs/`
- `examples/`

### 15. Verify

Run:

```bash
pnpm nx run-many -t test,build,lint -p <name>
```

Then:

```bash
pnpm nx affected -t build,test,lint
```

### Summary of the pattern

The core idea is simple: instead of building to a shared `dist/packages/<name>/` at the workspace root, each package builds to its own `packages/<name>/dist/`. The `exports` map with `@nx/nx-source` condition lets workspace packages resolve to `.ts` source files during development, while external consumers get the built `.js` from `dist/`. This is like giving each package its own "output mailbox" instead of sharing one big mailbox.
