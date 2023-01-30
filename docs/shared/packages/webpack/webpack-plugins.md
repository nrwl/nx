---
title: Webpack plugins
description: A guide for webpack plugins that are provided by Nx.
---

# Webpack plugins

Nx uses enhanced webpack configuration files (e.g. `webpack.config.js`). These configuration files export a _plugin_ that takes in a webpack
[configuration](https://webpack.js.org/configuration/) object and returns an updated configuration object. Plugins are used by Nx to add
functionality to the webpack build.

This guide contains information on the plugins provided by Nx. For more information on customizing webpack configuration, refer to the
[configuration guide](/packages/webpack/documents/webpack-config-setup).

## `withNx`

The `withNx` plugin provides common configuration for the build, including TypeScript support and linking workspace libraries (via tsconfig paths).

### Options

#### skipTypeChecking

Type: `boolean`

Disable type checks (useful to speed up builds).

### Example

```js
const { composePlugins, withNx } = require('@nrwl/webpack');

module.exports = composePlugins(withNx(), (config) => {
  // Further customize webpack config
  return config;
});
```

## `withWeb`

The `withWeb` plugin adds support for CSS/SASS/Less/Stylus stylesheets, assets (such as images and fonts), and `index.html` processing.

### Options

#### baseHref

Type: `string`

Base URL for the application being built.

#### crossOrigin

Type: `'none' | 'anonymous' | 'use-credentials'`

"The `crossorigin` attribute to use for generated javascript script tags. One of 'none' | 'anonymous' | 'use-credentials'."

#### deployUrl

Type: `string`

URL where the application will be deployed.

#### extractCss

Type: `boolean`

Extract CSS into a `.css` file.

#### generateIndexHtml

Type: `boolean`

Generates a `package.json` and pruned lock file with the project's `node_module` dependencies populated for installing in a container. If a `package.json` exists in the project's directory, it will be reused with dependencies populated.

#### index

Type: `string`

HTML File which will be contain the application.

#### postcssConfig

Type: `string`

Set a path (relative to workspace root) to a PostCSS config that applies to the app and all libs. Defaults to `undefined`, which auto-detects postcss.config.js files in each `app`.

#### scripts

Type: `string[]`

Paths to scripts (relative to workspace root) which will be included before the main application entry.

#### stylePreprocessorOptions

Type: `{ includePaths: string[] }`

Options to pass to style preprocessors. `includePaths` is a list of paths that are included (e.g. workspace libs with stylesheets).

#### styles

Type: `string[]`

Paths to stylesheets (relative to workspace root) which will be included with the application.

#### subresourceIntegrity

Type: `boolean`

Enables the use of subresource integrity validation.

### Example

```js
const { composePlugins, withNx, withWeb } = require('@nrwl/webpack');

module.exports = composePlugins(
  // always pass withNx() first
  withNx(),
  // add web functionality
  withWeb({
    styles: ['my-app/src/styles.css'],
  }),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

## `withReact`

The `withReact` plugin adds support for React JSX, [SVGR](https://react-svgr.com/), and [Fast Refresh](https://github.com/pmmmwh/react-refresh-webpack-plugin)

### Options

The options are the same as [`withWeb`](#with-web) plus the following.

#### svgr

Type: `undefined|false`

SVGR allows SVG files to be imported as React components. Set this to `false` to disable this behavior.

### Example

```js
const { composePlugins, withNx } = require('@nrwl/webpack');
const { withReact } = require('@nrwl/react');

module.exports = composePlugins(
  withNx(), // always pass withNx() first
  withReact({
    styles: ['my-app/src/styles.css'],
    svgr: true,
    postcssConfig: 'my-app/postcss',
  }),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

## `withModuleFederation`

```js
const { composePlugins, withNx } = require('@nrwl/webpack');

module.exports = composePlugins(withNx(), (config) => {
  // Further customize webpack config
  return config;
});
```
