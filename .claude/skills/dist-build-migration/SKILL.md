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

If the package already has a hand-written `build-base.outputs` array, **delete it** — don't try to patch it. An incomplete override that omits `dist/tsconfig.tsbuildinfo` causes a sandbox violation in _every consumer_ that has a TypeScript project reference to this package: their `tsc --build` reads the referenced project's `.tsbuildinfo`, but `dependentTasksOutputFiles` can only collect it if this package declares it as an output.

Verify the inferred outputs include the tsbuildinfo:

```bash
pnpm nx show project <name> --json | jq '.targets["build-base"].outputs'
# Must include "{projectRoot}/dist/tsconfig.tsbuildinfo"
```

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

### 14b. (Optional) Lock down `./src/*` and route internal consumers through `./internal`

When you ship the migration, the package's `exports` map exposes everything under `./src/*` if you keep the wildcard. That's a 100s-of-symbols-wide semi-private surface that pins the implementation layout forever — consumers (first-party and external) can reach into any source file. The cleaner long-term shape, matching `@nx/devkit`/`@nx/workspace`, is to drop the wildcard and route internal consumers through a single curated `./internal` entry. Skip this step if you'd rather defer (e.g. the package has very heavy internal usage and you'd prefer a smaller PR), but plan a follow-up.

#### When to lock down vs defer

- **Lock down in the same PR** if internal subpath imports number in the low hundreds AND the package isn't `workspace:*`-pinned by other not-yet-migrated packages whose dist code would crash at runtime against the older published version (see "Published-version mismatch" below).
- **Defer to a follow-up PR** if the inventory is huge OR if dist-output code in other workspace packages depends on the OLD `./src/*` paths and those packages can't be migrated to local-dist yet. Lock down only once the immediate runtime-resolution surface is contained.

#### Step-by-step

**1. Inventory the subpath imports.** Scan for `from '@nx/<name>/src/...'`, plus runtime `require()`, dynamic `import()`, and `jest`/`vi.mock`-family calls:

```bash
grep -rEln "from ['\"]@nx/<name>/src/" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" packages/ e2e/ scripts/
grep -rEln "(require|jest\.mock|jest\.requireActual)\(['\"]@nx/<name>/src/" packages/ e2e/ scripts/
```

Compile a `subpath → set-of-imported-symbols` map. About 30 distinct subpaths and 60 symbols is typical for a package the size of `@nx/js`.

**2. Identify runtime-string-resolved subpaths.** Some subpaths are referenced by _string default values_ the nx runtime resolves later (not static imports). The classic example: `packages/nx/src/command-line/release/config/config.ts` has `DEFAULT_VERSION_ACTIONS_PATH = '@nx/js/src/release/version-actions'`. These strings are also baked into pre-existing user `nx.json` files and you cannot rewrite them via a migration. **Keep those exact subpaths as explicit non-wildcard entries in the exports map** (not under `./internal`), and have the migration skip rewriting them.

```bash
# Search for string-default usages of the subpath in nx core
grep -rEn "['\"]@nx/<name>/src/[^'\"]+['\"]" packages/nx/src/ --include="*.ts"
```

**3. Build `packages/<name>/internal.ts` at the package ROOT** (not inside `src/`, to mirror `@nx/devkit/internal`). Re-export every symbol callers reach for via `@nx/<name>/src/*`, BUT only symbols not already exported from `packages/<name>/src/index.ts`. Anything already public stays public — the migration sends those callers to `@nx/<name>`, not `@nx/<name>/internal`.

To compute the public set:

```bash
grep -E "^export " packages/<name>/src/index.ts
```

…and recursively expand any `export *` lines. The "public-export reachability" calculation is fiddly enough that a small Python script with a recursive expand is worth it (see PR #35538 commit history for an example).

Curate the new file:

```ts
// Semi-private surface for first-party Nx packages.
//
// External plugins should NOT import from here — this entry is curated for
// internal consumers and may change without semver protection. Mirrors
// `@nx/devkit/internal`.

// Re-exports of nx-source internals (need `no-restricted-imports` overrides).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
export { ... } from 'nx/src/plugins/.../something';

export { walkTsconfigExtendsChain, type RawTsconfigJsonCache } from './src/utils/typescript/raw-tsconfig';
// ... and so on, grouping by area.
```

Delete any pre-existing `packages/<name>/src/internal.ts` once its exports have been folded in.

**4. Update `packages/<name>/package.json`.** Drop wildcards, add `./internal`, keep runtime-string subpaths as explicit entries:

```jsonc
{
  "exports": {
    ".": {
      "@nx/nx-source": "./src/index.ts",
      "types": "./dist/src/index.d.ts",
      "default": "./dist/src/index.js",
    },
    "./package.json": "./package.json",
    "./migrations.json": "./migrations.json",
    "./generators.json": "./generators.json",
    "./executors.json": "./executors.json",
    // Public side-channels (whatever you already had).
    "./babel": {
      "@nx/nx-source": "./babel.ts",
      "types": "./dist/babel.d.ts",
      "default": "./dist/babel.js",
    },
    // The new curated entry.
    "./internal": {
      "@nx/nx-source": "./internal.ts",
      "types": "./dist/internal.d.ts",
      "default": "./dist/internal.js",
    },
    // Runtime-string-resolved subpath kept for back-compat.
    "./src/release/version-actions": {
      "@nx/nx-source": "./src/release/version-actions.ts",
      "types": "./dist/src/release/version-actions.d.ts",
      "default": "./dist/src/release/version-actions.js",
    },
    // DROPPED: "./src/*", "./src/*.js", "./src/*/schema", "./src/*/schema.json"
  },
}
```

Also strip `src/*` glob entries from `typesVersions`. Replace with explicit non-wildcard entries that mirror the kept exports.

**5. Codemod consumers in two passes.** Mechanical sed-style first, then a smarter split:

```bash
# Pass 1: every `from '@nx/<name>/src/...'` → `from '@nx/<name>/internal'`,
# except the preserved subpaths from step 2.
# (Use a Python/TS script — sed is fine for the simple cases too.)
```

```bash
# Pass 2: split mixed imports. Any line like
#   import { libraryGenerator, ensureTypescript } from '@nx/<name>/internal';
# where `libraryGenerator` is publicly exported from `src/index.ts` becomes:
#   import { libraryGenerator } from '@nx/<name>';
#   import { ensureTypescript } from '@nx/<name>/internal';
```

Also handle these non-static cases:

- `jest.mock('@nx/<name>/src/...', ...)` and `jest.requireActual(...)` — same rewrite. The whole mock surface is now `@nx/<name>/internal`, so `...jest.requireActual('@nx/<name>/internal')` spreads more than the original site mocked, but that's fine in practice.
- Runtime `require('@nx/<name>/src/...')` — same rewrite.
- Template-string fixtures inside `.spec.ts` files — careful! Don't let your codemod rewrite literal `from "@nx/<name>/internal"` substrings that _test_ the migration (it'll flip quote style and break the test). Either skip `*.spec.ts` files containing fixtures, or operate at AST level.

**6. Collapse duplicate imports.** After the two-pass codemod, many files end up with two `import { ... } from '@nx/<name>/internal'` lines (or two `from '@nx/<name>'`). Run a third pass to merge same-source-same-`type`-prefix imports:

```python
# Match lines (anchored): `^import [type ]{ ... } from '@nx/<name>[/internal]';$`
# Group by (is_type_only, source). For each group with >1 entry: keep the first
# occurrence's position, merge the named bindings (dedupe), delete the others.
# Don't merge across type/non-type — the semantics differ.
```

**7. Public-symbol audit.** After splitting, `internal.ts` must not re-export anything already exported from `src/index.ts`. If it does, namespace consumers (`import * as shared from '@nx/<name>/internal'`) will see only the curated set and `shared.publiclyExportedSymbol` becomes `undefined`. Cross-check:

```bash
# Symbols in internal.ts that are ALSO in the recursive index.ts export set
# are a bug. Remove them from internal.ts. The codemod from step 5 should
# have already routed their callers to `@nx/<name>`, but verify nothing is
# left pointing at `@nx/<name>/internal` for these.
```

The three load-bearing patterns to verify:

- `import * as shared from '@nx/<name>/internal'` followed by `shared.publicSymbol` — fix by changing source to `@nx/<name>`.
- Runtime `const shared = require('@nx/<name>/internal')` followed by `shared.publicSymbol` — same fix.
- Named imports of public symbols from `@nx/<name>/internal` — already split by step 5; verify nothing slipped through.

**8. Ship a migration.** Add `packages/<name>/src/migrations/update-<version>/rewrite-<name>-internal-subpath-imports.ts` based on the workspace `move-typescript-compilation-import` template. It needs to handle:

- Static `import [type] { ... } from '@nx/<name>/src/<anything>'`
- Dynamic `import('@nx/<name>/src/<anything>')`
- `require('@nx/<name>/src/<anything>')`
- `jest.mock|unmock|doMock|dontMock|requireActual|requireMock|importActual|importMock(...)` and the `vi.` equivalents

Skip the preserved subpaths from step 2 (e.g. `@nx/<name>/src/release/version-actions`). Use `ts.createSourceFile` for AST-based detection so you don't rewrite literals inside comments, template strings, or `typeof import('...')` type queries.

Register in `packages/<name>/migrations.json` with `version: <current beta>`. Include a description that names the public-symbol caveat: "if a rewritten import resolves to a symbol that lives on the public `@nx/<name>` entry, change the specifier to `@nx/<name>`."

Add a spec covering: single-quoted, double-quoted, type-only, deep subpath, `.js` extension, `require()`, dynamic `import()`, jest mock family, vi mock family, preserved subpaths, non-`@nx/<name>` imports, `typeof import()` type queries, unrelated string literals inside comments.

**9. Watch for the published-version-mismatch gotcha in example/test builds.**

The workspace's root `node_modules/@nx/<name>` is the _published_ version (root `package.json` pins it to a real release tag, not `workspace:*`). When code at `dist/packages/<X>/...` does `require('@nx/<name>/internal')` at runtime, Node walks up from `dist/` and finds workspace-root `node_modules/@nx/<name>` — the published copy. If that version was released BEFORE this PR, it has no `internal.js` and resolution fails.

Symptom:

```
Error: Cannot find module '@nx/<name>/internal'
  requireStack: [
    '/path/to/workspace/dist/packages/<X>/src/utils/foo.js',
    ...
  ]
}
```

This bites specifically for examples or e2e flows that load `dist/packages/<other-package>/...` artifacts (e.g. an angular-rspack module-federation example that monkey-patches `Module._resolveFilename` to redirect `@nx/<other-package>` to dist). If the other-package's dist code does `require('@nx/<name>/internal')`, you'll hit this.

Two fixes:

- **(Preferred, if applicable.)** Migrate the _other_ package to local-dist too. Then its built code lives at `packages/<other>/dist/...`, walks up to `packages/<other>/node_modules/@nx/<name>` (a workspace symlink to source), and resolution finds the new `internal.js` because workspace source has it.
- **(Band-aid for the in-between window.)** If migrating the other package is out of scope, extend the example's existing request-path patch to also redirect `@nx/<name>/internal` to the workspace source `packages/<name>/dist/internal`. Document it as a temporary measure tied to the same TODO that exists for the other-package redirect.

Search aggressively for this pattern after step 8:

```bash
grep -rln "patchModuleFederationRequestPath\|Module._resolveFilename" examples/ e2e/ packages/
```

Any file that monkeypatches resolution is a candidate for needing the redirect.

#### Validation

After steps 1–9:

```bash
# Build the package (emits dist/internal.{js,d.ts})
pnpm nx run <name>:build-base

# Lint the package — @nx/dependency-checks may complain that the package
# "uses itself" because of the dynamic self-reference in versions.ts. Add
# `@nx/<name>` to `ignoredDependencies` in the dependency-checks rule config
# (with a comment explaining: self-reference for require(join('@nx/<name>', 'package.json'))).
pnpm nx run <name>:lint

# Spec the migration
pnpm nx test <name> -- --testPathPatterns=rewrite-<name>-internal-subpath-imports

# Full affected — catches consumers, example monkey-patches, and any
# missed split-mixed-imports.
pnpm nx affected -t build,lint --base=<base-sha-before-migration>
```

If `nx affected` fails on a single example test with `Cannot find module '@nx/<name>/internal'`, that's step 9 — extend the example's request-path patch.

If `nx affected` fails on a package with `TS2339: Property 'foo' does not exist on type 'typeof import(".../internal")'`, that's step 7 — a `shared.publicSymbol` call survived. Find it (`grep -rn 'shared\.<symbol>' packages/`) and rewrite the namespace source to `@nx/<name>`.

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
