For an overview of the plugin and setup instructions, see the [@nx/webpack introduction](/docs/technologies/build-tools/webpack/introduction).

The @nx/webpack plugin provides various migrations to help you migrate to newer versions of webpack projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-remove-nx-tsconfig-paths-webpack-plugin-import`
**Version**: 23.0.0-beta.10

Rewrites imports of NxTsconfigPathsWebpackPlugin from '@nx/webpack' to the sub-path '@nx/webpack/tsconfig-paths-plugin'.

#### Rewrite `NxTsconfigPathsWebpackPlugin` Imports to the `@nx/webpack/tsconfig-paths-plugin` Sub-path

The deprecated re-export of `NxTsconfigPathsWebpackPlugin` from `@nx/webpack` is removed in v23. The migration rewrites both ES module imports and CJS `require()` calls to use the `@nx/webpack/tsconfig-paths-plugin` sub-path. Imports that combine the deprecated symbol with other named imports are split into two declarations so the rest of the original import still resolves from `@nx/webpack`. Aliases (`as Plugin`, `: Plugin`) are preserved.

#### Sample Code Changes

ES module import.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack';

export default { plugins: [new NxTsconfigPathsWebpackPlugin()] };
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';

export default { plugins: [new NxTsconfigPathsWebpackPlugin()] };
```

ES module import combined with other named imports.

##### Before

```ts title="apps/my-app/webpack.config.ts" {1}
import { NxTsconfigPathsWebpackPlugin, NxAppWebpackPlugin } from '@nx/webpack';
```

##### After

```ts title="apps/my-app/webpack.config.ts"
import { NxTsconfigPathsWebpackPlugin } from '@nx/webpack/tsconfig-paths-plugin';
import { NxAppWebpackPlugin } from '@nx/webpack';
```

CJS `require()`.

##### Before

```js title="apps/my-app/webpack.config.js" {1}
const { NxTsconfigPathsWebpackPlugin } = require('@nx/webpack');
```

##### After

```js title="apps/my-app/webpack.config.js"
const {
  NxTsconfigPathsWebpackPlugin,
} = require('@nx/webpack/tsconfig-paths-plugin');
```



### `rewrite-webpack-internal-subpath-imports`
**Version**: 23.0.0-beta.24

Rewrites `@nx/webpack/src/*` subpath imports now that the `./src/*` subpath is no longer exposed by `@nx/webpack`'s exports map. Named imports/exports of public symbols are routed to `@nx/webpack` and the rest to the new `@nx/webpack/internal` entry; `require`, dynamic `import` and `jest.mock` calls reference the whole module and are routed to `@nx/webpack/internal`.


### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/webpack/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/webpack` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/webpack/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/webpack/plugin';
```

##### After

```ts
import { createNodes } from '@nx/webpack/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/webpack/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-package-updates
**Version**: 23.0.0-beta.24


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `webpack` | `^5.101.3` | Added if not installed
| `webpack-dev-server` | `^5.2.1` | Added if not installed
| `webpack-cli` | `^7.0.0` | Added if not installed



## 22.0.x

### `update-22-0-0-remove-deprecated-options`
**Version**: 22.0.0-beta.0

Remove deprecated deleteOutputPath and sassImplementation options from @nx/webpack:webpack



## 21.5.x

### 21.5.0-package-updates
**Version**: 21.5.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `webpack` | `5.101.3` | Updated only



## 21.0.x

### `update-21-0-0-remove-isolated-config`
**Version**: 21.0.0-beta.11

Remove isolatedConfig option for @nx/webpack:webpack

#### Remove `isolatedConfig` option

The `isolatedConfig` option is no longer supported by the `@nx/webpack:webpack` executor. Previously, setting `isolatedConfig: false` allowed you to use the executor's built-in Webpack configuration.

If this option is set in `project.json`, then it will be removed in favor of an explicit `webpackConfig` file. The Webpack configuration file matches the previous built-in configuration of the `@nx/webpack:webpack` executor.

#### Sample Code Changes

##### Before

```json title="project.json"
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "isolatedConfig": false
      }
    }
  }
}
```

##### After

```json title="project.json" {6}
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/myapp/webpack.config.js"
      }
    }
  }
}
```



