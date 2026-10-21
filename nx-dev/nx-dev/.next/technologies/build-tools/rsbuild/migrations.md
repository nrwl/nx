For an overview of the plugin and setup instructions, see the [@nx/rsbuild introduction](/docs/technologies/build-tools/rsbuild/introduction).

The @nx/rsbuild plugin provides various migrations to help you migrate to newer versions of rsbuild projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.1.x

### `update-23-0-0-migrate-rsbuild-config-to-v2`
**Version**: 23.1.0-beta.0

Rewrites rsbuild.config.{js,ts,mjs,cjs} files for @rsbuild/core@2: renames preview.setupMiddlewares to server.setupMiddlewares, drops the removed performance.removeMomentLocale option, moves source.alias/source.aliasStrategy to the resolve block, and updates server.proxy entries for http-proxy-middleware v4 (context to pathFilter, on* handlers to a unified on object).

#### Requires

| Name | Version |
|------|---------|
 `@rsbuild/core` | `>=2.0.0` |

### `update-23-0-0-migrate-node-output-to-esm`
**Version**: 23.1.0-beta.0

AI-assisted migration: make Node-target rsbuild builds runnable under @rsbuild/core@2, which emits ESM output by default.

#### Requires

| Name | Version |
|------|---------|
 `@rsbuild/core` | `>=2.0.0` |

### `update-23-0-0-migrate-performance-options`
**Version**: 23.1.0-beta.0

AI-assisted migration: adopt replacements for the performance.bundleAnalyze and performance.profile options removed in @rsbuild/core@2, and migrate the deprecated performance.chunkSplit option to splitChunks.

#### Requires

| Name | Version |
|------|---------|
 `@rsbuild/core` | `>=2.0.0` |

### 23.0.0-rsbuild-v2-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rsbuild/core` | `^2.0.7` | Updated only
| `@rsbuild/plugin-react` | `^2.0.0` | Updated only
| `@rsbuild/plugin-sass` | `^1.5.2` | Updated only



## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/rsbuild` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/rsbuild` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/rsbuild` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/rsbuild';
```

##### After

```ts
import { createNodes } from '@nx/rsbuild';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/rsbuild` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



