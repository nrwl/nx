For an overview of the plugin and setup instructions, see the [@nx/vitest introduction](/docs/technologies/test-tools/vitest/introduction).

The @nx/vitest plugin provides various migrations to help you migrate to newer versions of vitest projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.3.x

### `migrate-to-vitest-5`
**Version**: 23.3.0-beta.8

Migrate workspaces past breaking changes for Vitest 5.

#### Requires

| Name | Version |
|------|---------|
 `vitest` | `>=5.0.0` |

### 23.3.0-vitest-v5-package-updates
**Version**: 23.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^5.0.0` | Updated only


### 23.3.0-vitest-v5-coverage-v8-package-updates
**Version**: 23.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@vitest/coverage-v8` | `^5.0.0` | Updated only


### 23.3.0-vitest-v5-coverage-istanbul-package-updates
**Version**: 23.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@vitest/coverage-istanbul` | `^5.0.0` | Updated only


### 23.3.0-vitest-v5-ui-package-updates
**Version**: 23.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@vitest/ui` | `^5.0.0` | Updated only



## 23.2.x

### `update-23-2-0-use-import-meta-dirname`
**Version**: 23.2.0-beta.6

Replace `__dirname` with `import.meta.dirname` in `vite.config.mts`/`vitest.config.mts` files so they work with Vite's `configLoader: 'native'`.

#### Replace `__dirname` with `import.meta.dirname` in Vite config files

Vite 8 warns when a config uses features that its `configLoader: 'native'` mode cannot support, and `__dirname` is one of them:

```
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - `__dirname` (packages/utils/vitest.config.mts:4:9). Use `import.meta.dirname` instead
```

This migration rewrites `__dirname` to `import.meta.dirname` in every `vite.config.mts`, `vite.config.mjs`, `vitest.config.mts`, and `vitest.config.mjs` file in your workspace.

#### Sample Code Changes

##### Before

```ts
export default defineConfig(() => ({
  root: __dirname,
}));
```

##### After

```ts
export default defineConfig(() => ({
  root: import.meta.dirname,
}));
```

#### What is not rewritten

`.ts` and `.js` configs are left alone, since those extensions can still be loaded as CommonJS, where `import.meta` is a syntax error. Configs that declare their own `__dirname` (usually `const __dirname = path.dirname(fileURLToPath(import.meta.url))`) are also left alone - that idiom already works under the native config loader.

No migration renames an existing config to `.mts`, because other tooling may reference it by path. So a workspace whose config is `.ts` keeps the companion warning about ESM syntax in a CommonJS-loaded file. Rename it yourself, or set `"type": "module"` in the closest `package.json`, to clear that one. Newly generated configs use `.mts` and are unaffected.

One generated case does put `import.meta.dirname` in a `.ts` config: `@nx/nuxt` falls back to `.ts` on workspaces still using eslintrc, because the legacy `@nuxt/eslint-config` cannot parse `.mts`. Vite's default config loader bundles that file, so it works today, but the file is not loadable under `configLoader: 'native'` - its own `import` statements already make it so.




## 23.1.x

### 23.1.0-analog-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.6.0` | Updated only
| `@analogjs/vitest-angular` | `~2.6.0` | Updated only



## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/vitest` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/vitest` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/vitestst` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/vitestst';
```

##### After

```ts
import { createNodes } from '@nx/vitestst';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/vitestst` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.1-happy-dom-package-updates
**Version**: 23.0.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `happy-dom` | `^20.10.4` | Updated only



## 22.6.x

### `update-22-6-0-prefix-reports-directory`
**Version**: 22.6.0-beta.11

Prefix reportsDirectory with {projectRoot} to maintain correct resolution after workspace-root-relative behavior change.

#### Prefix `reportsDirectory` with `{projectRoot}`

The `reportsDirectory` option for `@nx/vitest:test` (and `@nx/vite:test`) is now resolved relative to the workspace root instead of the project root. This migration prepends `{projectRoot}/` to existing `reportsDirectory` values so the resolved path remains the same.

#### Sample Code Changes

##### Before

```json title="project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "reportsDirectory": "coverage/libs/my-lib"
      }
    }
  }
}
```

##### After

```json title="project.json" {6}
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "reportsDirectory": "{projectRoot}/coverage/libs/my-lib"
      }
    }
  }
}
```




## 22.3.x

### `update-22-3-2`
**Version**: 22.3.2-beta.0

Create AI Instructions to help migrate users workspaces past breaking changes for Vitest 4.

#### Requires

| Name | Version |
|------|---------|
 `@angular/build` | `>=21.0.0` |
 `vitest` | `>=4.0.0` |

### 22.3.2-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.8` | Updated only
| `@vitest/coverage-v8` | `^4.0.8` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.8` | Updated only
| `@vitest/ui` | `^4.0.8` | Updated only
| `jsdom` | `^27.1.0` | Updated only


### 22.3.2-analog-package-updates
**Version**: 22.3.2-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.2.0` | Updated only
| `@analogjs/vitest-angular` | `~2.2.0` | Updated only



## 22.2.x

### 22.2.0-analog-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@analogjs/vite-plugin-angular` | `~2.1.2` | Updated only
| `@analogjs/vitest-angular` | `~2.1.2` | Updated only



## 22.1.x

### `update-22-1-0`
**Version**: 22.1.0-beta.8

Create AI Instructions to help migrate users workspaces past breaking changes for Vitest 4.

#### Requires

| Name | Version |
|------|---------|
 `vitest` | `>=4.0.0` |

### 22.1.0-package-updates
**Version**: 22.1.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `vitest` | `^4.0.0` | Updated only
| `@vitest/coverage-v8` | `^4.0.0` | Updated only
| `@vitest/coverage-istanbul` | `^4.0.0` | Updated only
| `@vitest/ui` | `^4.0.0` | Updated only


