---
title: Webpack plugins
description: A guide for webpack plugins that are provided by Nx.
---

# Webpack plugins

Nx provides two types of Webpack plugins:

1. [_Basic_](#basic-plugins) plugins that work in a
   standard [webpack configuration](https://webpack.js.org/configuration/) file.
2. [_Nx-enhanced_](#nxenhanced-plugins) plugins that work with
   the [`@nx/webpack:webpack`](/technologies/build-tools/webpack/api/executors/webpack) executor.

The basic plugins are used in Nx 18 to provide seamless integration with the Webpack CLI. Prior to Nx 18, apps are
generated with Nx-enhanced plugins and require `@nx/webpack:webpack` executor to be used.

This guide contains information on the plugins provided by Nx. For more information on webpack configuration and the
difference between basic and Nx-enhanced configuration, refer to
the [Nx Webpack configuration guide](/technologies/build-tools/webpack/recipes/webpack-config-setup).

## Basic plugins

The basic plugins work with a standard webpack configuration file by adding them to the `plugins` option.

### NxAppWebpackPlugin

The `NxAppWebpackPlugin` plugin provides common configuration for the build, including TypeScript support and linking
workspace libraries (via tsconfig paths).

#### Options

##### tsConfig

Type: `string`

The tsconfig file for the project. e.g. `tsconfig.json`.

##### main

Type: `string`

The entry point for the bundle. e.g. `src/main.ts`.

##### additionalEntryPoints

Type: `Array<{ entryName: string; entryPath: string; }>`

Secondary entry points for the bundle.

#### assets

Type: `string[]`

Assets to be copied over to the output path.

##### babelConfig

Type: `string`

Babel configuration file if compiler is babel.

##### babelUpwardRootMode

Type: `boolean`
If true, Babel will look for a babel.config.json up the directory tree.

##### baseHref

Type: `string`

Set `<base href>` for the resulting index.html.

##### buildLibsFromSource

Type: `boolean`

Build the libraries from source. Default is `true`.

##### compiler

Type: `'babel' | 'swc' | 'tsc'`

The compiler to use. Default is `babel` and requires a `.babelrc` file.

##### crossOrigin

Type: `'none' | 'anonymous' | 'use-credentials'`

Set `crossorigin` attribute on the `script` and `link` tags.

##### deleteOutputPath

Type: `boolean`

Delete the output path before building.

**`Deprecated`**

Use [`output.clean`](https://webpack.js.org/guides/output-management/#cleaning-up-the-dist-folder) instead.

##### deployUrl

Type: `string`

The deploy path for the application. e.g. `/my-app/`

##### externalDependencies

Type: `'all' | 'none' | string[]`

Define external packages that will not be bundled. Use `all` to exclude all 3rd party packages, and `none` to bundle all
packages. Use an array to exclude specific packages from the bundle. Default is `none`.

##### extractCss

Type: `boolean`

Extract CSS as an external file. Default is `true`.

##### extractLicenses

Type: `boolean`
Extract licenses from 3rd party modules and add them to the output.

##### fileReplacements

Type: `FileReplacement[]`

Replace files at build time. e.g. `[{ "replace": "src/a.dev.ts", "with": "src/a.prod.ts" }]`

##### generateIndexHtml

Type: `boolean`

Generate an `index.html` file if `index.html` is passed. Default is `true`

##### generatePackageJson

Type: `boolean`

Generate a `package.json` file for the bundle. Useful for Node applications.

##### index

Type: `string`

Path to the `index.html`.

##### memoryLimit

Type: `number`

Set the memory limit for the type-checking process. Default is `2048`.

##### namedChunks

Type: `boolean`

Use the source file name in output chunks. Useful for development or for Node.

##### optimization

Type: `boolean`

Optimize the bundle using Terser.

##### outputFileName

Type: `string`

Specify the output filename for the bundle. Useful for Node applications that use `@nx/js:node` to serve.

##### outputHashing

Type: `'none' | 'all'`

Use file hashes in the output filenames. Recommended for production web applications.

##### outputPath

Type: `string`

Override `output.path` in webpack configuration. This setting is not recommended and exists for backwards compatibility.

##### poll

Type: `number`

Override `watchOptions.poll` in webpack configuration. This setting is not recommended and exists for backwards
compatibility.

##### polyfills

Type: `string`

The polyfill file to use. Useful for supporting legacy browsers. e.g. `src/polyfills.ts`

##### postcssConfig

Type: `string`
Manually set the PostCSS configuration file. By default, PostCSS will look for `postcss.config.js` in the directory.

##### progress

Type: `boolean`

Display build progress in the terminal.

##### runtimeChunk

Type: `boolean`

Add an additional chunk for the Webpack runtime. Defaults to `true` when `target === 'web'`.

##### scripts

Type: `string[]`

External scripts that will be included before the main application entry.

##### skipOverrides

Type: `boolean`

Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option.

##### skipPackageManager

Type: `boolean`

Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option.

##### skipTypeChecking

Type: `boolean`

Skip type checking. Default is `false`.

##### sourceMap

Type: `boolean | 'hidden'`

Generate source maps.

##### ssr

Type: `boolean`

When `true`, `process.env.NODE_ENV` will be excluded from the bundle. Useful for building a web application to run in a
Node environment.

##### statsJson

Type: `boolean`

Generate a `stats.json` file which can be analyzed using tools such as `webpack-bundle-analyzer`.

##### stylePreprocessorOptions

Type: `object`

Options for the style preprocessor. e.g. `{ "includePaths": [] }` for SASS.

##### styles

Type: `string[]`

External stylesheets that will be included with the application.

##### subresourceIntegrity

Type: `boolean`

Enables the use of subresource integrity validation.

##### target

Type: `string | string[]`

Override the `target` option in webpack configuration. This setting is not recommended and exists for backwards
compatibility.

##### transformers

Type: `TransformerEntry[]`

List of TypeScript Compiler Transformers Plugins.

##### vendorChunk

Type: `boolean`

Generate a separate vendor chunk for 3rd party packages.

##### verbose

Type: `boolean`

Log additional information for debugging purposes.

##### watch

Type: `boolean`

Watch for file changes.

##### watchDependencies

Type: `boolean`

Watch for buildable dependencies and rebuild when they change. Default is `true`.

#### Example

```js
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/demo'),
  },
  devServer: {
    port: 4200,
  },
  plugins: [
    new NxAppWebpackPlugin({
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      index: './src/index.html',
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
  ],
};
```

### NxReactWebpackPlugin

#### Options

##### svgr

Type: `boolean`

Enables or disables [React SVGR](https://react-svgr.com/). Default is `true`.

**Deprecated:** Add SVGR support in your Webpack configuration without relying on Nx. This option will be removed in Nx 22. See https://react-svgr.com/docs/webpack/

#### Example

```js
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { join } = require('path');

module.exports = {
  // ...
  plugins: [
    new NxReactWebpackPlugin({
      svgr: false,
    }),
  ],
};
```

## Nx-enhanced plugins

The Nx-enhanced plugins work with `@nx/webpack:webpack` executor and receive the target options and context from the
executor. These are used prior to Nx 18, and are still used when using [Module Federation](/technologies/module-federation/concepts/module-federation-and-nx).

The plugins are used in conjunction with `composePlugins` utility to generate a final Webpack configuration object, once all of the plugins have applied their changes.

```js {% fileName="webpack.config.js" %}
const { composePlugins } = require('@nx/webpack');

function myCustomPlugin() {
  // `options` and `context` are the target options and
  // `@nx/webpack:webpack` executor context respectively.
  return (webpackConfig, { options, context }) => {
    // Do something with the config.
    return webpackConfig;
  };
}

module.export = composePlugins(withNx(), withReact(), myCustomPlugin());
```

### withNx

The `withNx` plugin provides common configuration for the build, including TypeScript support and linking workspace
libraries (via tsconfig paths).

#### Options

##### skipTypeChecking

Type: `boolean`

Disable type checks (useful to speed up builds).

#### Example

```js
const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => {
  // Further customize webpack config
  return config;
});
```

### withWeb

The `withWeb` plugin adds support for CSS/SASS/Less stylesheets, assets (such as images and fonts), and `index.html`
processing.

#### Options

##### baseHref

Type: `string`

Base URL for the application being built.

##### crossOrigin

Type: `'none' | 'anonymous' | 'use-credentials'`

"The `crossorigin` attribute to use for generated javascript script tags. One of 'none' | 'anonymous' | '
use-credentials'."

##### deployUrl

Type: `string`

URL where the application will be deployed.

##### extractCss

Type: `boolean`

Extract CSS into a `.css` file.

#### generateIndexHtml

Type: `boolean`

Generates `index.html` file to the output path. This can be turned off if using a webpack plugin to generate HTML such
as `html-webpack-plugin`.

##### index

Type: `string`

HTML File which will be contain the application.

##### postcssConfig

Type: `string`

Set a path (relative to workspace root) to a PostCSS config that applies to the app and all libs. Defaults
to `undefined`, which auto-detects postcss.config.js files in each `app`.

##### scripts

Type: `string[]`

Paths to scripts (relative to workspace root) which will be included before the main application entry.

##### stylePreprocessorOptions

Type: `{ includePaths: string[] }`

Options to pass to style preprocessors. `includePaths` is a list of paths that are included (e.g. workspace libs with
stylesheets).

##### styles

Type: `string[]`

Paths to stylesheets (relative to workspace root) which will be included with the application.

##### subresourceIntegrity

Type: `boolean`

Enables the use of subresource integrity validation.

### Example

```js
const { composePlugins, withNx, withWeb } = require('@nx/webpack');

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

### withReact

The `withReact` plugin adds support for React JSX, [SVGR](https://react-svgr.com/),
and [Fast Refresh](https://github.com/pmmmwh/react-refresh-webpack-plugin)

#### Options

The options are the same as [`withWeb`](#withweb) plus the following.

##### svgr

Type: `undefined|false`

SVGR allows SVG files to be imported as React components. Set this to `false` to disable this behavior.

#### Example

```js
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

module.exports = composePlugins(
  withNx(), // always pass withNx() first
  withReact({
    styles: ['my-app/src/styles.css'],
    svgr: false,
    postcssConfig: 'my-app/postcss',
  }),
  (config) => {
    // Further customize webpack config
    return config;
  }
);
```

### withModuleFederation and withModuleFederationForSSR

The `withModuleFederation` and `withModuleFederationForSSR` plugins add module federation support to the webpack build.
These plugins use
[`ModuleFederationPlugin`](https://webpack.js.org/technologies/module-federation/concepts/) and provide a simpler API through Nx.

For more information, refer to
the [Module Federation recipe](/technologies/module-federation/concepts/faster-builds-with-module-federation).

#### Options

Both `withModuleFederation` and `withModuleFederationForSSR` share the same options. The `withModuleFederation` plugin
is for the browser, and the `withModuleFederationForSSR` plugin is used on the server-side (Node).

##### name

Type: `string`

The name of the host/remote application.

##### remotes

Type: `Aray<string[] | [remoteName: string, remoteUrl: string]>`

For _host_ to specify all _remote_ applications. If a string is used, Nx will match it with a matching remote in the
workspace.

Use `[<name>, <url>]` to specify the exact URL of the remote, rather than what's in the remote's `project.json` file.

##### library

Type: `{ type: string; name: string }`

##### exposes

Type: `Record<string, string>`

Entry points that are exposed from a _remote_ application.

e.g.

```js
exposes: {
  './Module'
:
  '<app-root>/src/remote-entry.ts',
}
,
```

##### shared

Type: `Function`

Takes a library name and the
current [share configuration](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints), and returns one
of

- `false` - Exclude this library from shared.
- `undefined` - Keep Nx sharing defaults.
- `SharedLibraryConfig` - Override Nx sharing defaults
  with [custom configuration](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints).

##### additionalShared

Type: `Array<string |{ libraryName: string; sharedConfig: SharedLibraryConfig }>`

Shared libraries in addition to the ones that Nx detects automatically. Items
match [`ModuleFederationPlugin`'s sharing configuration](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints).

{% tabs %}
{% tab label="React Module Federation" %}

```js
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact, withModuleFederation } = require('@nx/react');

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
} = require('@nx/angular/module-federation');

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
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact, withModuleFederatioForSSRn } = require('@nx/react');

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
} = require('@nx/angular/module-federation');

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
