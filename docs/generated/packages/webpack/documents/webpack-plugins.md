---
title: Webpack plugins
description: A guide for webpack plugins that are provided by Nx.
---

# Webpack plugins

Nx uses enhanced webpack configuration files (e.g. `webpack.config.js`). These configuration files export a _plugin_ that takes in a webpack
[configuration](https://webpack.js.org/configuration/) object and returns an updated configuration object. Plugins are used by Nx to add
functionality to the webpack build.

This guide contains information on the plugins provided by Nx. For more information on customizing webpack configuration, refer to the
[Nx Webpack configuration guide](/packages/webpack/documents/webpack-config-setup).

## withNx

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

## withWeb

The `withWeb` plugin adds support for CSS/SASS/Less stylesheets, assets (such as images and fonts), and `index.html` processing.

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

Generates `index.html` file to the output path. This can be turned off if using a webpack plugin to generate HTML such as `html-webpack-plugin`.

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

## withReact

The `withReact` plugin adds support for React JSX, [SVGR](https://react-svgr.com/), and [Fast Refresh](https://github.com/pmmmwh/react-refresh-webpack-plugin)

### Options

The options are the same as [`withWeb`](#withweb) plus the following.

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

## withModuleFederation and withModuleFederationForSSR

The `withModuleFederation` and `withModuleFederationForSSR` plugins add module federation support to the webpack build. These plugins use
[`ModuleFederationPlugin`](https://webpack.js.org/concepts/module-federation/) and provide a simpler API through Nx.

For more information, refer to the [Module Federation recipe](/recipes/module-federation/faster-builds).

### Options

Both `withModuleFederation` and `withModuleFederationForSSR` share the same options. The `withModuleFederation` plugin is for the browser, and the `withModuleFederationForSSR` plugin is used on the server-side (Node).

#### name

Type: `string`

The name of the host/remote application.

#### remotes

Type: `Aray<string[] | [remoteName: string, remoteUrl: string]>`

For _host_ to specify all _remote_ applications. If a string is used, Nx will match it with a matching remote in the workspace.

Use `[<name>, <url>]` to specify the exact URL of the remote, rather than what's in the remote's `project.json` file.

#### library

Type: `{ type: string; name: string }`

#### exposes

Type: `Record<string, string>`

Entry points that are exposed from a _remote_ application.

e.g.

```js
exposes: {
  './Module': '<app-root>/src/remote-entry.ts',
},
```

#### shared

Type: `Function`

Takes a library name and the current [share configuration](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints), and returns one of

- `false` - Exclude this library from shared.
- `undefined` - Keep Nx sharing defaults.
- `SharedLibraryConfig` - Override Nx sharing defaults with [custom configuration](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints).

#### additionalShared

Type: `Array<string |{ libraryName: string; sharedConfig: SharedLibraryConfig }>`

Shared libraries in addition to the ones that Nx detects automatically. Items match [`ModuleFederationPlugin`'s sharing configuration](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints).

{% tabs %}
{% tab label="React Module Federation" %}

```js
const { composePlugins, withNx } = require('@nrwl/webpack');
const { withReact, withModuleFederation } = require('@nrwl/react');

// Host config
// e.g. { remotes: ['about', 'dashboard'] }
const moduleFederationConfig = require('./module-federation.config');

module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(moduleFederationConfig),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

{% /tab %}
{% tab label="Angular Module Federation" %}

```js
const {
  composePlugins,
  withModuleFederation,
} = require('@nrwl/angular/module-federation');

// Host config
// e.g. { remotes: ['about', 'dashboard'] }
const moduleFederationConfig = require('./module-federation.config');

module.exports = composePlugins(
  withModuleFederation(moduleFederationConfig),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

{% /tab %}
{% tab label="React Module Federation for SSR " %}

```js
const { composePlugins, withNx } = require('@nrwl/webpack');
const { withReact, withModuleFederatioForSSRn } = require('@nrwl/react');

// Host config
// e.g. { remotes: ['about', 'dashboard'] }
const moduleFederationConfig = require('./module-federation.config');

module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederationForSSR(moduleFederationConfig),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

{% /tab %}
{% tab label="Angular Module Federation for SSR" %}

```js
const {
  composePlugins,
  withModuleFederationForSSR,
} = require('@nrwl/angular/module-federation');

// Host config
// e.g. { remotes: ['about', 'dashboard'] }
const moduleFederationConfig = require('./module-federation.config');

module.exports = composePlugins(
  withModuleFederationForSSR(moduleFederationConfig),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

{% /tab %}
{% /tabs %}
