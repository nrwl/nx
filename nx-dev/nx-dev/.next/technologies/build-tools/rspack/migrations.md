For an overview of the plugin and setup instructions, see the [@nx/rspack introduction](/docs/technologies/build-tools/rspack/introduction).

The @nx/rspack plugin provides various migrations to help you migrate to newer versions of rspack projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.1.x

### `update-23-0-0-migrate-rspack-config-to-v2`
**Version**: 23.1.0-beta.0

Rewrites rspack.config.{js,ts,mjs,cjs} files for @rspack/core@2: replaces output.libraryTarget with output.library.type and drops experiments.css: false (no-op on v2).

#### Requires

| Name | Version |
|------|---------|
 `@rspack/core` | `>=2.0.0` |

### `update-23-0-0-rewrite-experiments-css-to-module-rules`
**Version**: 23.1.0-beta.0

AI-assisted migration: rewrite experiments.css: true configs for @rspack/core@2 by injecting a CSS rule into module.rules.

#### Requires

| Name | Version |
|------|---------|
 `@rspack/core` | `>=2.0.0` |

### 23.0.0-rspack-v2-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rspack/core` | `^2.0.4` | Updated only
| `@rspack/dev-server` | `^2.0.1` | Updated only
| `@rspack/plugin-react-refresh` | `^2.0.0` | Updated only


### 23.0.0-module-federation-rspack-v2-package-updates
**Version**: 23.1.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^2.4.0` | Updated only
| `@module-federation/sdk` | `^2.4.0` | Updated only
| `@module-federation/runtime` | `^2.4.0` | Updated only
| `@module-federation/node` | `^2.7.42` | Updated only



## 23.0.x

### `update-23-0-0-add-svgr-to-rspack-config`
**Version**: 23.0.0-beta.9

Updates rspack configs using React to use the new withSvgr composable function instead of the svgr option in withReact or NxReactRspackPlugin.

#### Replace the `svgr` Option with the `withSvgr` Composable in Rspack Configs

Updates rspack configs that use React to use a new `withSvgr` composable function instead of passing an `svgr` option to `withReact` or `NxReactRspackPlugin`. The option was removed; SVG handling is now consolidated into the images asset rule by default. The migration inlines a `withSvgr` helper into each affected config so existing SVGR-as-React-component behavior is preserved.

#### Sample Code Changes

Replace the `svgr` option on `withReact` with a `withSvgr(...)` call composed alongside it.

##### Before

```js title="apps/myapp/rspack.config.js" {5}
const { composePlugins, withNx, withReact } = require('@nx/rspack');

module.exports = composePlugins(
  withNx(),
  withReact({ svgr: { svgo: false, titleProp: true, ref: true } })
);
```

##### After

```js title="apps/myapp/rspack.config.js"
const { composePlugins, withNx, withReact } = require('@nx/rspack');

// SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
function withSvgr(svgrOptions = {}) {
  const defaultOptions = { svgo: false, titleProp: true, ref: true };
  const options = { ...defaultOptions, ...svgrOptions };
  return function configure(config) {
    const svgLoaderIdx = config.module.rules.findIndex(
      (rule) =>
        typeof rule === 'object' &&
        typeof rule.test !== 'undefined' &&
        rule.test.toString().includes('svg')
    );
    if (svgLoaderIdx !== -1) {
      config.module.rules.splice(svgLoaderIdx, 1);
    }
    config.module.rules.push(
      { test: /\.svg$/i, type: 'asset', resourceQuery: /url/ },
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        resourceQuery: { not: [/url/] },
        use: [{ loader: '@svgr/webpack', options }],
      }
    );
    return config;
  };
}

module.exports = composePlugins(
  withNx(),
  withReact(),
  withSvgr({ svgo: false, titleProp: true, ref: true })
);
```

For the `NxReactRspackPlugin` style, the `svgr` option is removed from the plugin call and the entire `module.exports` is wrapped with a `withSvgr(...)` call that registers the loader rules directly on the compiler.

##### Before

```js title="apps/myapp/rspack.config.js" {5}
const { NxReactRspackPlugin } = require('@nx/rspack');

module.exports = {
  plugins: [new NxReactRspackPlugin({ svgr: true, main: './src/main.tsx' })],
};
```

##### After

```js title="apps/myapp/rspack.config.js"
const { NxReactRspackPlugin } = require('@nx/rspack');

// SVGR support function (migrated from svgr option in withReact/NxReactRspackPlugin)
function withSvgr(svgrOptions = {}) {
  /* same helper as above, compiler.options.module.rules variant */
}

module.exports = withSvgr()({
  plugins: [new NxReactRspackPlugin({ main: './src/main.tsx' })],
});
```



### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/rspack/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/rspack` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/rspack/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/rspack/plugin';
```

##### After

```ts
import { createNodes } from '@nx/rspack/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/rspack/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.




## 22.2.x

### 22.2.0-module-federation-enhanced-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.21.2` | Updated only


### 22.2.0-module-federation-sdk-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/sdk` | `^0.21.2` | Updated only


### 22.2.0-module-federation-runtime-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/runtime` | `^0.21.2` | Updated only


### 22.2.0-module-federation-node-package-updates
**Version**: 22.2.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/node` | `^2.7.21` | Updated only



## 22.0.x

### `remove-deprecated-rspack-options`
**Version**: 22.0.0-beta.1

Remove deprecated deleteOutputPath and sassImplementation options from rspack configurations.



## 21.5.x

### 21.5.0-package-updates
**Version**: 21.5.0-beta.2


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rspack/core` | `^1.5.0` | Updated only
| `@rspack/dev-server` | `^1.1.4` | Updated only



## 21.4.x

### 21.4.0-package-updates
**Version**: 21.4.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `http-proxy-middleware` | `^3.0.5` | Updated only



## 21.3.x

### 21.3.0-module-federation-enhanced-package-updates
**Version**: 21.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/enhanced` | `^0.17.0` | Updated only


### 21.3.0-module-federation-node-package-updates
**Version**: 21.3.0-beta.8


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@module-federation/node` | `^2.7.9` | Updated only



## 21.0.x

### 21.0.1-package-updates
**Version**: 21.0.1-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `@rspack/core` | `^1.3.8` | Updated only
| `@rspack/dev-server` | `^1.1.1` | Updated only


