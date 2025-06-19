---
title: '@nx/webpack Executors'
description: 'Complete reference for all @nx/webpack executor commands'
sidebar_label: Executors
---

# @nx/webpack Executors

The @nx/webpack plugin provides various executors to run tasks on your webpack projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `dev-server`

Serve an application using webpack.

**Usage:**

```bash
nx run &lt;project&gt;:dev-server [options]
```

#### Options

| Option           | Type    | Description                                                                             | Default     |
| ---------------- | ------- | --------------------------------------------------------------------------------------- | ----------- |
| `--allowedHosts` | string  | This option allows you to whitelist services that are allowed to access the dev server. |             |
| `--baseHref`     | string  | Base url for the application being built.                                               |             |
| `--buildTarget`  | string  | Target which builds the application.                                                    |             |
| `--hmr`          | boolean | Enable hot module replacement.                                                          | `false`     |
| `--host`         | string  | Host to listen on.                                                                      | `localhost` |
| `--liveReload`   | boolean | Whether to reload the page on change, using live-reload.                                | `true`      |
| `--memoryLimit`  | number  | Memory limit for type checking service process in `MB`.                                 |             |
| `--open`         | boolean | Open the application in the browser.                                                    | `false`     |
| `--port`         | number  | Port to listen on.                                                                      | `4200`      |
| `--publicHost`   | string  | Public URL where the application will be served.                                        |             |
| `--ssl`          | boolean | Serve using `HTTPS`.                                                                    | `false`     |
| `--sslCert`      | string  | SSL certificate to use for serving `HTTPS`.                                             |             |
| `--sslKey`       | string  | SSL key to use for serving `HTTPS`.                                                     |             |
| `--watch`        | boolean | Watches for changes and rebuilds application.                                           | `true`      |

### `ssr-dev-server`

Serve a SSR application using webpack.

**Usage:**

```bash
nx run &lt;project&gt;:ssr-dev-server [options]
```

#### Options

| Option                           | Type   | Description                                                     | Default |
| -------------------------------- | ------ | --------------------------------------------------------------- | ------- |
| `--browserTarget` **[required]** | string | Target which builds the browser application.                    |         |
| `--serverTarget` **[required]**  | string | Target which builds the server application.                     |         |
| `--browserTargetOptions`         | object | Additional options to pass into the browser build target.       | `{}`    |
| `--port`                         | number | The port to be set on `process.env.PORT` for use in the server. | `4200`  |
| `--serverTargetOptions`          | object | Additional options to pass into the server build target.        | `{}`    |

### `webpack`

Build a project using webpack.

**Usage:**

```bash
nx run &lt;project&gt;:webpack [options]
```

#### Options

| Option                            | Type    | Description                                                                                                                                                                                                                                  | Default     |
| --------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------ | --- |
| `--additionalEntryPoints`         | array   |                                                                                                                                                                                                                                              |             |
| `--assets`                        | array   | List of static application assets.                                                                                                                                                                                                           |             |
| `--babelConfig`                   | string  | Path to the babel configuration file of your project. If not provided, Nx will default to the .babelrc file at the root of your project. See https://babeljs.io/docs/en/config-files                                                         |             |
| `--babelUpwardRootMode`           | boolean | Whether to set rootmode to upward. See https://babeljs.io/docs/en/options#rootmode                                                                                                                                                           |             |
| `--baseHref`                      | string  | Base url for the application being built.                                                                                                                                                                                                    |             |
| `--buildLibsFromSource`           | boolean | Read buildable libraries from source instead of building them separately. If set to `false`, the `tsConfig` option must also be set to remap paths.                                                                                          | `true`      |
| `--commonChunk`                   | boolean | Use a separate bundle containing code used across multiple bundles.                                                                                                                                                                          |             |
| `--compiler`                      | string  | The compiler to use.                                                                                                                                                                                                                         |             |
| `--crossOrigin`                   | string  | The `crossorigin` attribute to use for generated javascript script tags. One of 'none'                                                                                                                                                       | 'anonymous' | 'use-credentials'. |     |
| `--deleteOutputPath`              | boolean | Delete the output path before building.                                                                                                                                                                                                      | `true`      |
| `--deployUrl`                     | string  | URL where the application will be deployed.                                                                                                                                                                                                  |             |
| `--externalDependencies`          | string  | Dependencies to keep external to the bundle. (`all` (default), `none`, or an array of module names)                                                                                                                                          |             |
| `--extractCss`                    | boolean | Extract CSS into a `.css` file.                                                                                                                                                                                                              |             |
| `--extractLicenses`               | boolean | Extract all licenses in a separate file, in the case of production builds only.                                                                                                                                                              |             |
| `--fileReplacements`              | array   | Replace files with other files in the build.                                                                                                                                                                                                 |             |
| `--generateIndexHtml`             | boolean | Generates `index.html` file to the output path. This can be turned off if using a webpack plugin to generate HTML such as `html-webpack-plugin`.                                                                                             |             |
| `--generatePackageJson`           | boolean | Generates a `package.json` and pruned lock file with the project's `node_module` dependencies populated for installing in a container. If a `package.json` exists in the project's directory, it will be reused with dependencies populated. |             |
| `--index`                         | string  | HTML File which will be contain the application.                                                                                                                                                                                             |             |
| `--main`                          | string  | The name of the main entry-point file.                                                                                                                                                                                                       |             |
| `--memoryLimit`                   | number  | Memory limit for type checking service process in `MB`.                                                                                                                                                                                      |             |
| `--namedChunks`                   | boolean | Names the produced bundles according to their entry file.                                                                                                                                                                                    |             |
| `--optimization`                  | string  | Enables optimization of the build output.                                                                                                                                                                                                    |             |
| `--outputFileName`                | string  | Name of the main output file.                                                                                                                                                                                                                | `main.js`   |
| `--outputHashing`                 | string  | Define the output filename cache-busting hashing mode.                                                                                                                                                                                       |             |
| `--outputPath`                    | string  | The output path of the generated files.                                                                                                                                                                                                      |             |
| `--poll`                          | number  | Enable and define the file watching poll time period.                                                                                                                                                                                        |             |
| `--polyfills`                     | string  | Polyfills to load before application                                                                                                                                                                                                         |             |
| `--postcssConfig`                 | string  | Set a path to PostCSS config that applies to the app and all libs. Defaults to `undefined`, which auto-detects postcss.config.js files in each `app`/`lib` directory.                                                                        |             |
| `--progress`                      | boolean | Log progress to the console while building.                                                                                                                                                                                                  |             |
| `--publicPath`                    | string  | Set a public path for assets resources with absolute paths.                                                                                                                                                                                  |             |
| `--rebaseRootRelative`            | boolean | Whether to rebase absolute path for assets in postcss cli resources.                                                                                                                                                                         |             |
| `--runtimeChunk`                  | boolean | Use a separate bundle containing the runtime.                                                                                                                                                                                                |             |
| `--sassImplementation`            | string  | The implementation of the SASS compiler to use. Can be either `sass` or `sass-embedded`. Defaults to `sass-embedded`.                                                                                                                        | `sass`      |
| `--scripts`                       | array   | External Scripts which will be included before the main application entry.                                                                                                                                                                   |             |
| `--skipOverrides`                 | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option.                                                                                          |             |
| `--skipPackageManager`            | boolean | Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option.                                                                                                         |             |
| `--skipTypeChecking`              | boolean | Skip the type checking. Default is `false`.                                                                                                                                                                                                  |             |
| `--sourceMap`                     | string  | Output sourcemaps. Use 'hidden' for use with error reporting tools without generating sourcemap comment.                                                                                                                                     |             |
| `--standardWebpackConfigFunction` | boolean | Set to true if the webpack config exports a standard webpack function, not an Nx-specific one. See: https://webpack.js.org/configuration/configuration-types/#exporting-a-function                                                           | `false`     |
| `--statsJson`                     | boolean | Generates a 'stats.json' file which can be analyzed using tools such as: 'webpack-bundle-analyzer' or `&lt;https://webpack.github.io/analyse&gt;`.                                                                                           |             |
| `--stylePreprocessorOptions`      | object  | Options to pass to style preprocessors.                                                                                                                                                                                                      |             |
| `--styles`                        | array   | External Styles which will be included with the application                                                                                                                                                                                  |             |
| `--subresourceIntegrity`          | boolean | Enables the use of subresource integrity validation.                                                                                                                                                                                         |             |
| `--target`                        | string  | Target platform for the build, same as the Webpack target option.                                                                                                                                                                            |             |
| `--transformers`                  | array   | List of TypeScript Compiler Transfomers Plugins.                                                                                                                                                                                             |             |
| `--tsConfig`                      | string  | The name of the Typescript configuration file.                                                                                                                                                                                               |             |
| `--vendorChunk`                   | boolean | Use a separate bundle containing only vendor libraries.                                                                                                                                                                                      |             |
| `--verbose`                       | boolean | Emits verbose output                                                                                                                                                                                                                         |             |
| `--watch`                         | boolean | Enable re-building when files change.                                                                                                                                                                                                        |             |
| `--webpackConfig`                 | string  | Path to a function which takes a webpack config, some context and returns the resulting webpack config. See https://nx.dev/guides/customize-webpack                                                                                          |             |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
