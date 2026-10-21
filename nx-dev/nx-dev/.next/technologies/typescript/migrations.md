For an overview of the plugin and setup instructions, see the [@nx/js introduction](/docs/technologies/typescript/introduction).

The @nx/js plugin provides various migrations to help you migrate to newer versions of js projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.2.x

### `update-23-2-0-add-pnpm-prune-lockfile-cache-config`
**Version**: 23.2.0-beta.11

Add the pnpm-workspace.yaml, patches, and local_path_modules paths to the outputs of @nx/js:prune-lockfile targets in pnpm workspaces, and the workspace root pnpm-workspace.yaml, package.json, and a pnpm-major runtime probe to their inputs, so a cache replay restores the pnpm install settings, patch files, and vendored local-path dependencies the executor now emits, and a change to the root pnpm install settings or a pnpm major switch does not replay a stale one.

#### Update the cache configuration of `@nx/js:prune-lockfile` targets for the pnpm install artifacts

In a pnpm workspace, the `@nx/js:prune-lockfile` executor emits more than the pruned `package.json` and `pnpm-lock.yaml`: a settings-only `pnpm-workspace.yaml`, the `.patch` files of a `pnpm patch` workspace under `patches/`, and non-workspace local-path dependencies (`file:` tarballs and directories, `link:` targets) under `local_path_modules/`. On pnpm 11 and above that workspace file is where the build-script approvals and `supportedArchitectures` live; on pnpm 10 and below they go into the emitted `package.json` and the file ships carrying only an empty `packages` list.

Targets generated before this change declare only the manifest and the lockfile in `outputs`, so a cache replay in a clean checkout restores just those two files. The missing `patches/` and `local_path_modules/` break the deploy install loudly. On pnpm 11 and above a missing `pnpm-workspace.yaml` is worse than loud: it silently drops the build-script approvals, and the deployed app's native dependencies never run their build scripts.

Those artifacts are built from pnpm settings the workspace root declares. The build approvals and `supportedArchitectures` among them are recorded nowhere in the lockfile, so nothing else in the task hash moves when they change, and the same targets declare no `inputs` at all. Revoking a build approval would replay the previous run's artifact from cache and ship an output that still grants it.

The three artifact paths are appended to whichever `outputs` array declares the `pnpm-lock.yaml` entry, reusing that entry's own path prefix. That covers a target's own `outputs` and the `targetDefaults` entries applying to prune-lockfile targets: entries keyed by the executor, declaring or filtering on it, and entries under a target-name or glob key that resolves to one of them. Configurations without `outputs`, configurations whose lockfile entry is not pnpm's, and paths already present are left untouched.

The two root sources, plus a `runtime` input probing the pnpm major (which decides whether the settings land in the emitted `pnpm-workspace.yaml` or the emitted `package.json` when the root manifest has no `packageManager` field; it is added even when the field currently pins a pnpm version, because the migration runs once and the pin can be removed later), go somewhere else, because a target's own `inputs` array replaces the defaults' rather than merging with it. Each target is classified by its merged `outputs`, so inheriting or spreading the lockfile entry still counts, and the sources are added once: to the target's own `inputs` when it declares them, and otherwise to the `targetDefaults` entry supplying the array it inherits. A target inheriting nothing gets nx's own default spelled out first, so nothing that was hashed stops being hashed. A source the target already hashes is left alone. A workspace with no prune-lockfile target at all, configuring them purely through `targetDefaults`, has the sources added to every compatible entry under the key that declares its own `inputs` (each can be the array a future target inherits, and a sibling's array covers nothing); when no filter-less entry declares any, the spelled-out default is prepended as a new entry, under a name or glob key pinned to the executor so same-name targets of other executors do not inherit it. The fallback is only authored where it cannot change which key a target resolves: under the executor key when a compatible filter-less entry already exists, and under a name or glob key when a compatible filter-less entry already pins the executor. Any other key gets no fallback, whether its compatible entries are all filtered or its filter-less entries do not pin the executor, because a new entry would make that key win selection for targets that previously resolved their defaults elsewhere.

The migration only ever appends to an array that already exists or writes that spelled-out default; it never authors a `"..."` of its own. Whether a spread finds anything to expand against depends on the identity resets in nx's own document-order merge, and one that finds nothing would leave the target hashing only the two root files.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "prune-lockfile": {
      "executor": "@nx/js:prune-lockfile",
      "outputs": [
        "{workspaceRoot}/dist/apps/app1/package.json",
        "{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml"
      ]
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "targets": {
    "prune-lockfile": {
      "executor": "@nx/js:prune-lockfile",
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/pnpm-workspace.yaml",
        "{workspaceRoot}/package.json",
        {
          "runtime": "node -e \"try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}\""
        }
      ],
      "outputs": [
        "{workspaceRoot}/dist/apps/app1/package.json",
        "{workspaceRoot}/dist/apps/app1/pnpm-lock.yaml",
        "{workspaceRoot}/dist/apps/app1/pnpm-workspace.yaml",
        "{workspaceRoot}/dist/apps/app1/patches",
        "{workspaceRoot}/dist/apps/app1/local_path_modules"
      ]
    }
  }
}
```



### `update-23-2-0-add-pnpm-deploy-output-cache-inputs`
**Version**: 23.2.0-beta.11

Add the workspace root pnpm-workspace.yaml, the pnpm settings fields of the root package.json, and a pnpm-major runtime probe to the inputs of build targets that emit the pruned pnpm deploy output (webpack, rspack, vite, esbuild with generatePackageJson; next, remix, tsc, swc with generateLockfile), so revoking a build-script approval, changing another pnpm install setting, or crossing the pnpm 10/11 boundary does not replay a cached output that still carries the old one.

#### Add the pnpm install settings sources to the inputs of build targets that emit the pruned deploy output

In a pnpm workspace, build executors that generate a deployable `package.json` also emit the pruned deploy output next to it: the pruned `pnpm-lock.yaml`, a settings-only `pnpm-workspace.yaml`, the `.patch` files of a `pnpm patch` workspace, and vendored local-path dependencies. webpack, rspack, vite and esbuild builds do this when `generatePackageJson` is enabled; next, remix, tsc and swc builds when `generateLockfile` is.

The build-script approvals and `supportedArchitectures` those artifacts carry come from the workspace root `pnpm-workspace.yaml` and the `pnpm` field of the root `package.json`, and are recorded in no lockfile, so nothing in the build target's default task hash moves when they change. Revoking an approval after a package turns out to be malicious would replay the previous build from cache and ship an output that still grants it.

The migration adds three inputs to the affected targets: the root `pnpm-workspace.yaml` as a fileset; a `json` input hashing only the fields of the root `package.json` the output is built from (`packageManager`, which selects whether the settings land in the emitted `pnpm-workspace.yaml` or the emitted `package.json`, plus `pnpm.onlyBuiltDependencies`, `pnpm.neverBuiltDependencies`, `pnpm.allowBuilds`, `pnpm.supportedArchitectures` and `pnpm.patchedDependencies`), so ordinary dependency bumps in the root manifest do not invalidate every build; and a `runtime` input probing the pnpm major, which decides that same file selection when the `packageManager` field is absent. The probe prints only the major, so pnpm patch and minor releases do not move the hash, and a sentinel when no pnpm binary is available, so it is safe in every workspace. It is added even when the field currently pins a pnpm version: the migration runs once, and the pin can be removed later.

The contents of vendored non-workspace local-path dependencies (`file:` directories and tarballs, `link:` targets) also ship in the deploy output but are not covered by these inputs: their set is derived from the lockfile at build time, so no statically written input list can stay correct as dependencies change.

A target's own `inputs` array replaces the defaults' rather than merging with it, so the inputs are added to the layer whose array the runtime actually uses: the target's own `inputs` when it declares them, otherwise the `targetDefaults` entry supplying the array it inherits, and otherwise the target itself with nx's own default spelled out first, so nothing that was hashed stops being hashed. The gating option is read from the merged view, so one supplied by a matching `targetDefaults` entry or set only in a configuration still counts. A source the target already hashes, including via a whole-file root `package.json` fileset or an existing `json` input covering the settings fields, is left alone. The migration never authors a `"..."` of its own.

Targets inferred by the `@nx/webpack` and `@nx/rspack` plugins declare the `pnpm-workspace.yaml` and `json` inputs themselves on every graph build, and the `runtime` probe while the root `package.json` has no `packageManager` field pinning a pnpm version, but a project-level target entry (under the exact name or a matching glob-pattern key) or a matching `targetDefaults` entry that supplies its own `inputs` array without `"..."` replaces the plugin-generated one and discards them. The migration repairs those overlays the same way, appending the complete set of three inputs to the replacing array, because it runs once and the pin can be removed later; when several entries match, only the last one applies, and it takes the repair. An inferred target with no such overlay is left alone, as is one whose entry changes what the target runs once merged: a different executor or effective command means the plugin's build no longer runs there. An entry that merely restates the identity the plugin infers is still an overlay and gets the repair.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "generatePackageJson": true
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "inputs": [
        "default",
        "^default",
        "{workspaceRoot}/pnpm-workspace.yaml",
        {
          "json": "{workspaceRoot}/package.json",
          "fields": [
            "packageManager",
            "pnpm.onlyBuiltDependencies",
            "pnpm.neverBuiltDependencies",
            "pnpm.allowBuilds",
            "pnpm.supportedArchitectures",
            "pnpm.patchedDependencies"
          ]
        },
        {
          "runtime": "node -e \"try{console.log('pnpm major '+require('child_process').execSync('pnpm --version',{stdio:['ignore','pipe','ignore']}).toString().trim().split('.')[0])}catch{console.log('pnpm major unavailable')}\""
        }
      ],
      "options": {
        "generatePackageJson": true
      }
    }
  }
}
```




## 23.1.x

### `23-1-0-add-ignore-deprecations-for-ts6`
**Version**: 23.1.0-beta.8

Adds `"ignoreDeprecations": "6.0"` to tsconfig files whose compilerOptions (or ts-node.compilerOptions) carry a TypeScript 6 deprecated option value, set directly or inherited through `extends` including from a base this migration does not edit (e.g. moduleResolution node/node10/classic, baseUrl, target es5, esModuleInterop false, outFile, module amd/umd/system/none, alwaysStrict false, allowSyntheticDefaultImports false, downlevelIteration set). Also pins `"strict": false`, `"noUncheckedSideEffectImports": false`, `"types": ["*"]`, and `"esModuleInterop": false` in chain-root tsconfigs (no "extends") that lack each key, preserving pre-TS6 behavior where these defaults changed; `esModuleInterop` false is itself deprecated (removed in TS7) so it also receives `ignoreDeprecations`, deferring the interop change to the TS7 migration. Also adds `ignoreDeprecations` to every `tsconfig.json` (the exact name jest/ts-node auto-resolve when compiling a config file; ts-node injects a deprecated default `target: es5` there, so the load can hit a TS6 error even on a clean config), even one with no deprecated value of its own; a stale local `ignoreDeprecations` (e.g. `5.0`) that would otherwise override the inherited flag is upgraded.

#### Requires

| Name | Version |
|------|---------|
 `typescript` | `>=6.0.0` |
#### Keep Existing Workspaces Compiling on TypeScript 6

TypeScript 6 turns several long-deprecated compiler options into hard errors and flips a few option defaults to stricter values. So that an existing workspace keeps compiling on TypeScript 6 without being migrated to a full TypeScript 6 setup, this migration edits the `tsconfig*.json` files in the workspace:

- Adds `"ignoreDeprecations": "6.0"` to any `compilerOptions` (or `ts-node.compilerOptions`) block whose effective options carry a TypeScript 6 deprecated option, set directly or inherited through `extends` (including from a base this migration does not edit, such as a package-provided config). Examples: `moduleResolution` set to `node`/`node10`/`classic`, `baseUrl`, `target` set to `es5`, `esModuleInterop: false`, `outFile`, `module` set to `amd`/`umd`/`system`/`none`, `alwaysStrict: false`, `allowSyntheticDefaultImports: false`, or `downlevelIteration`. A block that already inherits an effective `"6.0"` and sets no local value is left alone; a stale local value such as `"5.0"` is upgraded to `"6.0"`, since it would otherwise override the inherited flag and still error.
- Pins `"strict": false`, `"noUncheckedSideEffectImports": false`, `"types": ["*"]`, and `"esModuleInterop": false` on every chain-root tsconfig (one without an `extends`) that does not already set them. TypeScript 6 treats an absent `strict` as `true` (it was `false` when unset before), defaults `noUncheckedSideEffectImports` to `true` (which turns a bare side-effect import such as `import './styles.css'` without an ambient module declaration into an error), no longer auto-loads every `@types` package when `types` is unset the way TypeScript 5 did (the `"*"` wildcard restores that last default), and flips `esModuleInterop` from `false` to `true` (so an `import * as x from '<cjs>'` binds a non-callable namespace object and a call or `new` on that import fails at runtime). Pinning all four preserves the pre-TypeScript 6 behavior. Because `esModuleInterop: false` is itself a TypeScript 6 deprecated value, this pin runs before the `ignoreDeprecations` edit above, so the added `false` is silenced in the same run.
- Adds `"ignoreDeprecations": "6.0"` to every `tsconfig.json` (the exact file name jest and ts-node auto-resolve), even one that carries no deprecated option of its own. Those loaders compile config files such as `jest.config.ts`, and ts-node injects a default `target: es5` when the config leaves it unset. TypeScript 6 rejects `es5` as a deprecated value, so the flag keeps that load working. It is inert wherever nothing is actually deprecated.

Files that use `extends` inherit the pinned settings from their chain root, so the pins are not repeated on them, and pure solution-style tsconfigs (`"files": []` with no `include`) receive no pins either, though a solution-style `tsconfig.json` still gets the config-load flag. The migration only runs when the workspace is on TypeScript 6.

#### Sample Code Changes

##### Before

```json title="tsconfig.json"
{
  "compilerOptions": {
    "target": "es5",
    "module": "esnext",
    "moduleResolution": "bundler"
  }
}
```

##### After

```json title="tsconfig.json" {6-10}
{
  "compilerOptions": {
    "target": "es5",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": false,
    "noUncheckedSideEffectImports": false,
    "types": ["*"],
    "esModuleInterop": false,
    "ignoreDeprecations": "6.0"
  }
}
```



### `23-1-0-set-tsconfig-root-dir-for-ts6`
**Version**: 23.1.0-rc.2

Sets an explicit `rootDir` on project `tsconfig*.json` files that lack one, pinned to the source directory TypeScript 5 inferred implicitly, so programs keep compiling and emitting the same layout under TypeScript 6, which otherwise hard-fails with TS5011 or TS6059 (for example a spec tsconfig importing another project's source through a `paths` alias). The pin is written even when the inferred directory already equals the tsconfig directory, because tools like ts-jest with `isolatedModules` compile a program per file and re-infer a deeper directory from that subset. The value is computed by the compiler, so emit layout is unchanged. Each config is written on its own; the migration never writes to a shared `extends` base, so a config never inherits a value computed for a sibling. Composite projects are pinned to their own directory: `rootDir` already defaults there under `tsc` so it is a no-op for a real composite build, but ts-jest strips `composite` for its per-file transpile and the explicit value is needed to avoid TS5011 there.

#### Requires

| Name | Version |
|------|---------|
 `typescript` | `>=6.0.0` |
#### Pin the Inferred `rootDir` for TypeScript 6

Before TypeScript 6, a tsconfig that did not set `rootDir` had it inferred as the common directory of the program's non-declaration input files. TypeScript 6 changed that default to the tsconfig's own directory. A program whose files resolve outside that directory (most commonly a spec or e2e tsconfig that imports another project's source through a `paths` alias) now hard-fails with `TS5011` or `TS6059` because a file falls outside the assumed root.

For every project `tsconfig*.json` that does not already set `rootDir` (directly or through `extends`), this migration pins `rootDir` to exactly the directory TypeScript 5 would have inferred, so both compilation and emit layout stay the same under TypeScript 6. The value is computed by the TypeScript compiler itself, so it matches `tsc` exactly, including project-reference redirects. The pin is written even when the inferred directory already equals the tsconfig directory: inference is per-program, and a tool that compiles a subset of the config's files — ts-jest with `isolatedModules` builds a program per test file — re-infers a deeper common directory from that subset and fails with `TS5011`. Configs that cannot hit the error are skipped: ones without an output option (`outDir`, `outFile`, `sourceRoot`, `mapRoot`, or `declaration` + `declarationDir`), and ones with no input files. The migration only runs when the workspace is on TypeScript 6.

Composite projects are pinned to their own directory (`"."`). Under `tsc` a composite `rootDir` already defaults there, so the pin is a no-op for a real composite build — but ts-jest strips `composite` for its per-file transpile, and TypeScript 6 only exempts genuinely-composite programs from the containment check, so a composite spec config compiled by ts-jest still fails with `TS5011` without an explicit `rootDir`. Pinning the own directory (rather than a deeper file-derived value) keeps the composite build's emit layout unchanged while fixing the ts-jest case.

Each config is updated on its own; the migration never writes `rootDir` to a shared `extends` base, so a config never inherits a value computed for a sibling. Because every config that emits is given its own explicit `rootDir`, none is left to inherit a value pinned on a base.

#### Sample Code Changes

##### Before

A `libs/products/e2e/tsconfig.json` whose specs import a shared library's source:

```json title="libs/products/e2e/tsconfig.json"
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../../../dist/out-tsc"
  },
  "include": ["src/**/*.ts"]
}
```

##### After

```json title="libs/products/e2e/tsconfig.json" {4}
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "../../..",
    "outDir": "../../../dist/out-tsc"
  },
  "include": ["src/**/*.ts"]
}
```



### 23.1.0-typescript-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~6.0.3` | Updated only


### 23.1.0-swc-cli-package-updates
**Version**: 23.1.0-rc.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@swc/cli` | `~0.8.1` | Updated only



## 23.0.x

### `23-0-0-rewrite-internal-subpath-imports`
**Version**: 23.0.0-beta.14

Rewrites `@nx/js/src/*` subpath imports to the new `@nx/js/internal` entry. The `./src/*` wildcard has been removed from `@nx/js`'s exports map; `@nx/js/src/release/version-actions` is preserved as a non-wildcard entry for back-compat with existing nx.json release configs. If a rewritten import resolves to a symbol that lives on the public `@nx/js` entry (e.g. `libraryGenerator`, `extractTsConfigBase`, `resolvePathsBaseUrl`), change the specifier to `@nx/js`.


### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/js/typescript` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/js` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/js/typescript` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/js/typescript';
```

##### After

```ts
import { createNodes } from '@nx/js/typescript';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/js/typescript` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-swc-cli-package-updates
**Version**: 23.0.0-beta.17


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@swc/cli` | `~0.8.0` | Updated only



## 22.6.x

### 22.6.4-package-updates
**Version**: 22.6.4


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `verdaccio` | `^6.3.2` | Updated only



## 22.5.x

### 22.5.0-package-updates
**Version**: 22.5.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@swc/core` | `^1.15.5` | Updated only
| `@swc/helpers` | `^0.5.18` | Updated only
| `@swc-node/register` | `^1.11.1` | Updated only


### 22.5.0-swc-cli-package-updates
**Version**: 22.5.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@swc/cli` | `^0.7.10` | Updated only



## 22.1.x

### `remove-redundant-ts-project-references`
**Version**: 22.1.0-rc.1

Removes redundant TypeScript project references from project's tsconfig.json files when runtime tsconfig files (e.g., tsconfig.lib.json, tsconfig.app.json) exist.

#### Removes Redundant TypeScript Project References from tsconfig.json Files

Removes redundant TypeScript project references from `tsconfig.json` files when runtime tsconfig files (e.g., `tsconfig.lib.json`, `tsconfig.app.json`) exist. Previously, external project references were duplicated in both the project's `tsconfig.json` and runtime tsconfig files. This migration syncs the TypeScript project references to match the project graph, ensuring that external references only appear in runtime tsconfig files when they exist.

#### Examples

When a project has runtime tsconfig files like `tsconfig.lib.json`, the migration will remove external project references from the project's `tsconfig.json` file:

##### Before

```jsonc {7-9}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib",
    },
  ],
}
```

##### After

```jsonc {6}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [],
}
```

The external references remain in the runtime tsconfig file where they belong:

##### Before

```jsonc {7-9}
// libs/my-lib/tsconfig.lib.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib/tsconfig.lib.json",
    },
  ],
}
```

##### After

```jsonc {7-9}
// libs/my-lib/tsconfig.lib.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib/tsconfig.lib.json",
    },
  ],
}
```

For projects without runtime tsconfig files, the project's `tsconfig.json` file will continue to contain external project references:

##### Before

```jsonc {7-9}
// libs/legacy-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib",
    },
  ],
}
```

##### After

```jsonc {7-9}
// libs/legacy-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "../other-lib",
    },
  ],
}
```

Internal project references (references within the same project directory) are preserved in the project's `tsconfig.json`:

##### Before

```jsonc {7-12}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "./tsconfig.lib.json",
    },
    {
      "path": "./tsconfig.spec.json",
    },
  ],
}
```

##### After

```jsonc {7-12}
// libs/my-lib/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
  },
  "references": [
    {
      "path": "./tsconfig.lib.json",
    },
    {
      "path": "./tsconfig.spec.json",
    },
  ],
}
```




## 22.0.x

### `remove-external-options-from-js-executors`
**Version**: 22.0.0-beta.0

Remove the deprecated `external` and `externalBuildTargets` options from the `@nx/js:swc` and `@nx/js:tsc` executors.

#### Remove the `external` and `externalBuildTargets` Options from the `@nx/js:swc` and `@nx/js:tsc` Executors

Remove the deprecated `external` and `externalBuildTargets` options from the `@nx/js:swc` and `@nx/js:tsc` executors. These options were used for inlining dependencies, which was an experimental feature and has been deprecated for a long time. The migration only removes the options from the project configuration and target defaults. If you rely on inlining dependencies, you need to make sure they are all buildable or use a different build tool that supports bundling.

#### Sample Code Changes

Remove `external` and `externalBuildTargets` from the `@nx/js:swc` or `@nx/js:tsc` executor options in project configuration.

##### Before

```json title="libs/my-lib/project.json" {9-10}
{
  "targets": {
    "build": {
      "executor": "@nx/js:swc",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "tsConfig": "libs/my-lib/tsconfig.lib.json",
        "external": ["react", "react-dom"],
        "externalBuildTargets": ["build"]
      }
    }
  }
}
```

##### After

```json title="libs/my-lib/project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/js:swc",
      "options": {
        "main": "libs/my-lib/src/index.ts",
        "outputPath": "dist/libs/my-lib",
        "tsConfig": "libs/my-lib/tsconfig.lib.json"
      }
    }
  }
}
```

Remove `external` and `externalBuildTargets` from the `@nx/js:swc` or `@nx/js:tsc` executor target defaults in `nx.json`.

##### Before

```json title="nx.json" {8-9}
{
  "targetDefaults": {
    "@nx/js:swc": {
      "options": {
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "external": "all",
        "externalBuildTargets": ["build"]
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/js:swc": {
      "options": {
        "main": "{projectRoot}/src/index.ts",
        "outputPath": "dist/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json"
      }
    }
  }
}
```




## 21.5.x

### `migrate-development-custom-condition`
**Version**: 21.5.0-beta.2

Migrate the legacy 'development' custom condition to a workspace-unique custom condition name.

#### Migrate `development` custom condition to unique workspace-specific name

Replace the TypeScript `development` custom condition with a unique workspace-specific name to avoid conflicts when consuming packages in other workspaces.

#### Examples

The migration will update the custom condition name in both `tsconfig.base.json` and all workspace package.json files that use the `development` custom condition:

##### Before

```json title="tsconfig.base.json" {3}
{
  "compilerOptions": {
    "customConditions": ["development"]
  }
}
```

##### After

```json title="tsconfig.base.json" {3}
{
  "compilerOptions": {
    "customConditions": ["@my-org/source"] // assuming the root package.json name is `@my-org/source`
  }
}
```

The migration also updates `package.json` files that use the `development` condition in their `exports` field and point to TypeScript files:

##### Before

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

##### After

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "@my-org/source": "./src/index.ts",
      "default": "./dist/index.js"
    }
  }
}
```

If the custom condition is not set to `["development"]` or the `package.json`'s `exports` field doesn't point to TypeScript files, the migration will not modify the configuration:

##### Before

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

##### After

```json title="libs/my-lib/package.json" {5}
{
  "name": "@myorg/my-lib",
  "exports": {
    ".": {
      "development": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```



### 21.5.0-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~5.9.2` | Updated only



## 21.2.x

### 21.2.0-package-updates
**Version**: 21.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `typescript` | `~5.8.2` | Updated only


