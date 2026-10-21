For an overview of the plugin and setup instructions, see the [@nx/vite introduction](/docs/technologies/build-tools/vite/introduction).

The @nx/vite plugin provides various migrations to help you migrate to newer versions of vite projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `ensure-vitest-package-migration-23`
**Version**: 23.0.0-beta.10

Safety net: ensure any remaining @nx/vite:test executor usages are swapped to @nx/vitest:test and @nx/vitest is installed.

# ensure-vitest-package-migration (Nx v23)

Migration that runs automatically when upgrading to Nx 23. It is a safety net for workspaces that still have `@nx/vite` vitest artifacts in place after the optional v22 migration.

## What it does

1. **Installs `@nx/vitest`**: added to `devDependencies` when vitest is detected in the workspace (skipped when already present or when the workspace does not use vitest at all).
2. **Swaps `@nx/vite:test` to `@nx/vitest:test`**: updates every `project.json` target and every `targetDefaults` entry that still references the removed executor.
3. **Splits `@nx/vite/plugin` registrations**: vitest-related options (`testTargetName`, `ciTargetName`, `ciGroupName`) are extracted from each `@nx/vite/plugin` entry and moved to a new `@nx/vitest` plugin entry. The vite entry is updated to retain only build/serve/preview options.
4. **Registers `@nx/vitest` plugin**: for workspaces that used `@nx/vite/plugin` in its default configuration (no vitest options), a matching `@nx/vitest` plugin entry is added automatically so vitest targets continue to be inferred.

## Why this migration exists

The vitest support that previously lived in `@nx/vite` (the `@nx/vite:test` executor, the `@nx/vite:vitest` generator, and the vitest target inference in `@nx/vite/plugin`) was removed in Nx 23 and is now exclusively provided by the `@nx/vitest` package. See the [Migrating from @nx/vite guide](/technologies/test-tools/vitest/guides/migrating-from-nx-vite).

## No action required

Run `nx migrate` and this migration will handle the conversion automatically. To verify the result, check `nx.json`, your `project.json` files, and `package.json` after running migrations.



### `rename-rollup-options-to-rolldown-options`
**Version**: 23.0.0-beta.10

Rename `rollupOptions` to `rolldownOptions` in vite config files (top-level and inside `environments`). Vite 8 replaced Rollup with Rolldown.

#### Requires

| Name | Version |
|------|---------|
 `vite` | `>=8.0.0` |
#### Rename `rollupOptions` to `rolldownOptions` in Vite Config Files

Renames the `rollupOptions` property to `rolldownOptions` inside `vite.config.{js,ts,mjs,mts,cjs,cts}` files. [Vite 8 replaced Rollup with Rolldown](https://vite.dev/blog/announcing-vite8) as its production bundler; `rollupOptions` is accepted as a deprecated alias but logs a warning and may produce precedence surprises when both keys are present. The migration covers top-level usage as well as nested `environments.<env>.build.rollupOptions`.

The migration only touches files matching `vite.*config*.{js,ts,mjs,mts,cjs,cts}`. Helper modules imported by your config and `rollupOptions` declared elsewhere need to be renamed by hand.

#### Sample Code Changes

Top-level rename inside `build`.

##### Before

```ts title="apps/myapp/vite.config.ts" {3}
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['react'],
    },
  },
});
```

##### After

```ts title="apps/myapp/vite.config.ts"
export default defineConfig({
  build: {
    rolldownOptions: {
      external: ['react'],
    },
  },
});
```

The same rename applies inside `environments.<env>.build`.

##### Before

```ts title="apps/myapp/vite.config.ts" {5}
export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: { external: ['fs'] },
      },
    },
  },
});
```

##### After

```ts title="apps/myapp/vite.config.ts"
export default defineConfig({
  environments: {
    ssr: {
      build: {
        rolldownOptions: { external: ['fs'] },
      },
    },
  },
});
```

> **Note**: Rolldown is largely Rollup-compatible but a handful of options have different semantics. The most common one to check after this migration: `output.manualChunks` only accepts a function in Rolldown (the object-of-globs form is invalid). See `tools/ai-migrations/MIGRATE_VITE_8.md` (created by a sibling migration) for the full Vite 8 upgrade checklist.



### `create-ai-instructions-for-vite-8`
**Version**: 23.0.0-beta.10

Create AI Instructions to help migrate users workspaces past breaking changes for Vite 8.

#### Requires

| Name | Version |
|------|---------|
 `vite` | `>=8.0.0` |

### `migrate-to-vitest-3`
**Version**: 23.0.0-beta.22

Migrate workspaces past breaking changes for Vitest 3.

#### Requires

| Name | Version |
|------|---------|
 `vitest` | `>=3.0.0` |

### `migrate-to-vitest-4`
**Version**: 23.0.0-beta.22

Migrate workspaces past breaking changes for Vitest 4.

#### Requires

| Name | Version |
|------|---------|
 `vitest` | `>=4.0.0` |

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/vite/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/vite` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/vite/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/vite/plugin';
```

##### After

```ts
import { createNodes } from '@nx/vite/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/vite/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-package-updates
**Version**: 23.0.0-beta.10


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vite` | `^8.0.0` | Updated only
| `@vitejs/plugin-react` | `^6.0.0` | Updated only


### 23.0.0-vitest-v3-floor-package-updates
**Version**: 23.0.0-beta.22


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^3.0.0` | Updated only
| `@vitest/coverage-v8` | `^3.0.0` | Updated only
| `@vitest/coverage-istanbul` | `^3.0.0` | Updated only
| `@vitest/ui` | `^3.0.0` | Updated only


### 23.0.0-vitest-v4-package-updates
**Version**: 23.0.0-beta.22


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.0` | Updated only
| `@vitest/coverage-v8` | `^4.0.0` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.0` | Updated only
| `@vitest/ui` | `^4.0.0` | Updated only



## 22.2.x

### `update-22-2-0`
**Version**: 22.2.0-beta.1

Create AI Instructions to help migrate users workspaces past breaking changes for Vitest 4.

#### Requires

| Name | Version |
|------|---------|
 `vitest` | `>=4.0.0` |

### `migrate-vitest-to-vitest-package`
**Version**: 22.2.0-beta.2

Migrate Vitest usage from @nx/vite to @nx/vitest package.


### 22.2.0-package-updates
**Version**: 22.2.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.0` | Updated only
| `@vitest/coverage-v8` | `^4.0.0` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.0` | Updated only
| `@vitest/ui` | `^4.0.0` | Updated only


### 22.2.0-analog-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.1.2` | Updated only


### 22.2.0-analog-vitest-angular-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vitest-angular` | `~2.1.2` | Updated only



## 21.5.x

### 21.5.0-package-updates
**Version**: 21.5.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vite` | `^7.1.3` | Updated only



## 21.3.x

### 21.3.0-package-updates
**Version**: 21.3.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~1.19.1` | Updated only
| `@analogjs/vitest-angular` | `~1.19.1` | Updated only



## 21.2.x

### 21.2.0-package-updates
**Version**: 21.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~1.17.1` | Updated only
| `@analogjs/vitest-angular` | `~1.17.1` | Updated only



## 21.1.x

### 21.1.2-package-updates
**Version**: 21.1.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vitest-angular` | `~1.16.1` | Updated only


