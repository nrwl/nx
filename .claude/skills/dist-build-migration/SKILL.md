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

### 0. Preflight: check `workspace:*` deps for unmigrated packages

Read `packages/<name>/package.json` and list every `workspace:*` dep (in `dependencies`, `devDependencies`, `peerDependencies`).

For each such dep, look at the target package's `project.json`. If it does **not** override `release.version.manifestRootsToUpdate` to `["packages/{projectName}"]`, that target package is still on the old layout. You **must** migrate those packages too (apply this skill to each), in the same PR.

**Why:** With `preserveLocalDependencyProtocols: true` (the new pattern), `nx release version` does not substitute `workspace:*` in your manifest. At publish time, pnpm resolves `workspace:*` by reading the target's _source_ `packages/<dep>/package.json`. The default `manifestRootsToUpdate: ["dist/packages/{projectName}"]` only bumps the dist copy, so pnpm picks up the unbumped source `0.0.1` and publishes your package with a dep on a version that does not exist in the registry. Local registry installs then fail with `ERR_PNPM_NO_MATCHING_VERSION`.

A `workspace:*` dep on a still-on-old-layout package is a hard blocker — migrate it before continuing.

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
- Change `"main"` to `"./dist/index.js"`
- Change `"types"` to `"./dist/index.d.ts"`
- Add `"typesVersions"` for backwards compatibility with `moduleResolution: "node"` consumers
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

Add a `typesVersions` field for consumers using `moduleResolution: "node"` (which doesn't read `exports`):

```json
"typesVersions": {
  "*": {
    "testing": ["dist/testing.d.ts"],
    "ngcli-adapter": ["dist/ngcli-adapter.d.ts"]
  }
}
```

Add an entry for each subpath export (excluding `.`, `./package.json`, and `./migrations.json`).

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
    }
  }
}
```

Do **not** override `build-base.outputs` in `project.json`. The `@nx/js/typescript` plugin reads `outDir` and `tsBuildInfoFile` from `tsconfig.lib.json` and infers the correct outputs (including the tsbuildinfo and the full set of file extensions). A hand-written override is almost always less complete than the inferred set.

Update the existing `build` target's `outputs` if they reference `{workspaceRoot}/dist/packages/<name>` — they should now reference `{projectRoot}/dist/`.

Also update `dependsOn` in the `build` target: replace `"^build"` with `"^build"` if it isn't already, and make sure `"build-base"` is listed.

### 7. Update eslint config

Add `dist` to the ignores. For flat config (`eslint.config.mjs`):

```js
{ ignores: ['**/__fixtures__/**', 'dist'] },
```

For legacy `.eslintrc.json`:

```json
"ignorePatterns": ["!**/*", "node_modules", "dist"]
```

Do **not** add `*.d.ts` or `**/*.d.ts` — the base config already ignores `**/dist`, and `tsconfig.lib.json` (Step 4) sends all generated `.d.ts` files into `dist`, so they're already out of scope. Hand-authored `.d.ts` files in `src/` (e.g. `schema.d.ts`) generally don't need ignoring.

### 8. Update `assets.json` (if exists)

Change `outDir` from `"dist/packages/<name>"` to `"packages/<name>/dist"`.

### 9. Add `files` field to `package.json`

Instead of using `.npmignore`, add a `"files"` field to `package.json` (matching the `nx` package pattern). Remove `.npmignore` if it exists.

```json
"files": [
  "dist",
  "!dist/tsconfig.tsbuildinfo",
  "migrations.json"
]
```

Adjust based on the package's needs:

- Add `"executors.json"` and/or `"generators.json"` if the package has them
- Add any other non-TS files that need to be published
- npm always includes `package.json` and `README.md` automatically — no need to list them

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

Under the section that lists generated README files (look for `packages/nx/README.md`), add:

```
packages/<name>/README.md
```

The generated README is written next to source (not into `dist/`), so it needs its own ignore.

Do **not** add a `packages/<name>/**/*.d.ts` rule. The root `.gitignore` already has a top-level `dist` entry that ignores every `dist/` directory in the repo — and `tsconfig.lib.json` (Step 4) sets `declarationDir: "dist"`, so all generated `.d.ts` files land there. Adding a package-wide `**/*.d.ts` rule plus `!` re-includes for hand-authored `.d.ts` files (like committed `schema.d.ts` source files) is redundant defense-in-depth.

### 12. Update docs generation paths

Check `astro-docs/src/plugins/utils/` for any code that references `.d.ts` files from the package. The docs generation reads `.d.ts` entry points to build API reference pages. Paths that previously pointed to `dist/packages/<name>/foo.d.ts` (workspace root dist) or `packages/<name>/foo.d.ts` (package root) now need to point to `packages/<name>/dist/foo.d.ts`.

For example, `devkit-generation.ts` had to be updated to look for `packages/devkit/dist/index.d.ts` instead of `packages/devkit/index.d.ts`.

### 13. Update `scripts/nx-release.ts`

Two things to do here:

1. **Add the package to `packagesToReset`.** That array (around `scripts/nx-release.ts:76`) is the snapshot/restore list — every package whose source `package.json` gets mutated by `nx release` (because it now publishes from `packages/<name>/` directly, not `dist/packages/<name>/`) must be in this list. Otherwise the release will leave `packages/<name>/package.json` dirty in the working tree after running. **Easy to forget — and there is no test that catches it.**

2. **Update any package-specific paths.** If the package has special release handling (like devkit's `hackFixForDevkitPeerDependencies`), update any paths from `./dist/packages/<name>/` to `./packages/<name>/`.

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

### 15. Audit `require('../../package.json')` (or similar relative paths to the package.json)

Search for `require\(['"]\.\..*package\.json` inside `packages/<name>/src/`. Any TS source file that reads the package's own `package.json` via a relative path is a **layout-fragility bug** that this migration triggers:

- Before migration: source `packages/<name>/src/utils/versions.ts` → built `dist/packages/<name>/src/utils/versions.js`. `'../../package.json'` resolves to `dist/packages/<name>/package.json` (which the old build path copied there).
- After migration: source unchanged → built `packages/<name>/dist/src/utils/versions.js`. `'../../package.json'` now resolves to `packages/<name>/dist/package.json` — **doesn't exist**. Every consumer that pulls in `nxVersion`/`NX_VERSION`/etc. crashes at module-load time with `Cannot find module '../../package.json'`. This breaks e2e tests broadly because most generators load `versions.ts`.

**Fix**: replace the relative path with a **package-name self-reference**, using the dynamic `join()` form so eslint's `@nx/enforce-module-boundaries` doesn't trip on it:

```ts
// Before
export const nxVersion = require('../../package.json').version;

// After
import { join } from 'path';
export const nxVersion = require(join('@nx/<name>', 'package.json')).version;
```

A literal `require('@nx/<name>/package.json')` works at runtime but trips `enforce-module-boundaries`'s `noSelfCircularDependencies` check — the rule statically pattern-matches self-imports and fires before checking whether the import resolves to a non-main entry. The dynamic `join()` form is opaque to the static check, matches `@nx/devkit`'s established pattern, and resolves to the same path at runtime.

Node resolves `@nx/<name>/package.json` via `node_modules` (workspace symlink in dev, real install in published), and the package.json's `exports` map already declares `./package.json` (you ensured this in Step 5). Works identically in source and dist contexts.

Reference implementations:

- `packages/nx/src/utils/versions.ts` — `require('nx/package.json').version` (works because `nx` is the project's own name; the static rule's entry-point check is lenient for the top-level `nx` package specifically)
- `packages/devkit/src/utils/package-json.ts` — `NX_VERSION = require(join('nx', 'package.json')).version` (dynamic form)

This was the source of the workspace-migration e2e regressions (PR #35643) and is one of the most-failure-prone steps to forget. Audit aggressively.

### 16. Preserve `add-extra-dependencies` if the package has one

`scripts/add-dependency-to-build.js` is a release-time hack that injects an extra dep into the **published** `package.json` (e.g., it adds `nx` to `@nx/workspace`'s `dependencies`). It is **not dead code** — without it the transitive resolution chain breaks for downstream consumers.

Concretely: created workspaces depend on `@nx/js`, which transitively depends on `@nx/workspace`. When the fork in `generate-preset.ts` runs `nx g @nx/workspace:preset`, Node's `require.resolve('@nx/workspace/package.json')` only finds the transitively-installed package because pnpm hoists `nx` along with `@nx/workspace` into `.pnpm/node_modules/` — and `nx` is hoisted there only because the **published** `@nx/workspace/package.json` declares it as a regular dependency. Drop that injection and the fork in the new workspace fails with `Unable to resolve @nx/workspace:preset` → `unable to find tsconfig.base.json`.

When migrating a package that has the `add-extra-dependencies` target:

1. **Keep** the target in `packages/<name>/project.json`.
2. **Update** `scripts/add-dependency-to-build.js`: change the `pkgPath` from `../dist/packages/<package>/package.json` to `../packages/<package>/package.json` (the source manifest is now the published manifest under the local-dist layout).
3. **Keep** the `pnpm nx run-many -t add-extra-dependencies --parallel 8` invocations in `scripts/nx-release.ts` (both the GitHub-release path and the local-publish path) — they fire between `runNxReleaseVersion` and `nx run nx:expand-deps`.
4. Confirm the snapshot/reset list (`packagesToReset`) covers this package so the injection is undone after publish.

If the package does not have the target, leave the script and the run-many calls alone — they no-op for any project without the target.

### 17. Verify

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
