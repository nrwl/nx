---
title: '@nx/rspack Executors'
description: 'Complete reference for all @nx/rspack executor commands'
sidebar_label: Executors
---

# @nx/rspack Executors

The @nx/rspack plugin provides various executors to run tasks on your rspack projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `dev-server`

Run @rspack/dev-server to serve a project.

**Usage:**

```bash
nx run &lt;project&gt;:dev-server [options]
```

#### Options

| Option                         | Type    | Description                                      | Default     |
| ------------------------------ | ------- | ------------------------------------------------ | ----------- |
| `--buildTarget` **[required]** | string  | The build target for rspack.                     |             |
| `--host`                       | string  | Host to listen on.                               | `localhost` |
| `--mode`                       | string  | Mode to run the server in.                       |             |
| `--port`                       | number  | The port to for the dev-server to listen on.     |             |
| `--publicHost`                 | string  | Public URL where the application will be served. |             |
| `--ssl`                        | boolean | Serve using `HTTPS`.                             | `false`     |
| `--sslCert`                    | string  | SSL certificate to use for serving `HTTPS`.      |             |
| `--sslKey`                     | string  | SSL key to use for serving `HTTPS`.              |             |

### `module-federation-dev-server`

Serve a module federation application.

**Usage:**

```bash
nx run &lt;project&gt;:module-federation-dev-server [options]
```

#### Options

| Option                 | Type    | Description                                                                                                                                                                                                                                                                         | Default     |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `--buildTarget`        | string  | Target which builds the application.                                                                                                                                                                                                                                                |             |
| `--devRemotes`         | array   | List of Producer (remote) applications to run in development mode (i.e. using serve target).                                                                                                                                                                                        |             |
| `--host`               | string  | Host to listen on.                                                                                                                                                                                                                                                                  | `localhost` |
| `--isInitialHost`      | boolean | Whether the Consumer (host) that is running this executor is the first in the project tree to do so.                                                                                                                                                                                | `true`      |
| `--parallel`           | number  | Max number of parallel processes for building static Producers (remotes).                                                                                                                                                                                                           |             |
| `--pathToManifestFile` | string  | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic Producer (remote) applications relative to the workspace root.                                                                                                 |             |
| `--port`               | number  | Port to listen on.                                                                                                                                                                                                                                                                  | `4200`      |
| `--publicHost`         | string  | Public URL where the application will be served.                                                                                                                                                                                                                                    |             |
| `--skipRemotes`        | array   | List of Producer (remote) applications to not automatically serve, either statically or in development mode. This will not remove the Producers (remotes) from the `module-federation.config` file, and therefore the application may still try to fetch these Producers (remotes). |

This option is useful if you have other means for serving the Producer (remote) application(s).
**NOTE:** Producers (remotes) that are not in the workspace will be skipped automatically. | |
| `--ssl` | boolean | Serve using `HTTPS`. | `false` |
| `--sslCert` | string | SSL certificate to use for serving `HTTPS`. | |
| `--sslKey` | string | SSL key to use for serving `HTTPS`. | |
| `--static` | boolean | Whether to use a static file server instead of the rspack-dev-server. This should be used for Producer (remote) applications that are also Consumer (host) applications. | |
| `--staticRemotesPort` | number | The port at which to serve the file-server for the static Producers (remotes). | |

### `module-federation-ssr-dev-server`

Serve a SSR Consumer (host) application along with its known Producers (remotes).

**Usage:**

```bash
nx run &lt;project&gt;:module-federation-ssr-dev-server [options]
```

#### Options

| Option                           | Type    | Description                                                                                                                                                                          | Default     |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `--browserTarget` **[required]** | string  | Target which builds the browser application.                                                                                                                                         |             |
| `--serverTarget` **[required]**  | string  | Target which builds the server application.                                                                                                                                          |             |
| `--devRemotes`                   | array   | List of Producers (remote) applications to run in development mode (i.e. using serve target).                                                                                        |             |
| `--host`                         | string  | Host to listen on.                                                                                                                                                                   | `localhost` |
| `--isInitialHost`                | boolean | Whether the Consumer (host) that is running this executor is the first in the project tree to do so.                                                                                 | `true`      |
| `--pathToManifestFile`           | string  | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic Producers (remote) applications relative to the workspace root. |             |
| `--port`                         | number  | The port to be set on `process.env.PORT` for use in the server.                                                                                                                      | `4200`      |
| `--publicHost`                   | string  | Public URL where the application will be served.                                                                                                                                     |             |
| `--skipRemotes`                  | array   | List of Producers (remote) applications to not automatically serve, either statically or in development mode.                                                                        |             |
| `--ssl`                          | boolean | Serve using HTTPS.                                                                                                                                                                   | `false`     |
| `--sslCert`                      | string  | SSL certificate to use for serving HTTPS.                                                                                                                                            |             |
| `--sslKey`                       | string  | SSL key to use for serving HTTPS.                                                                                                                                                    |             |
| `--staticRemotesPort`            | number  | The port at which to serve the file-server for the static Producers (remotes).                                                                                                       |             |

### `module-federation-static-server`

Serve a Consumer (host) application statically along with it's Producers (remotes).

**Usage:**

```bash
nx run &lt;project&gt;:module-federation-static-server [options]
```

#### Options

| Option                         | Type   | Description | Default |
| ------------------------------ | ------ | ----------- | ------- |
| `--serveTarget` **[required]** | string |             |         |

### `rspack`

Run Rspack via an executor for a project.

**Usage:**

```bash
nx run &lt;project&gt;:rspack [options]
```

#### Options

| Option                           | Type    | Description                                                                                                                                                                                                                                  | Default |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--rspackConfig` **[required]**  | string  | The path to the rspack config file.                                                                                                                                                                                                          |         |
| `--additionalEntryPoints`        | array   |                                                                                                                                                                                                                                              |         |
| `--assets`                       | array   | List of static application assets.                                                                                                                                                                                                           | `[]`    |
| `--baseHref`                     | string  | Base url for the application being built.                                                                                                                                                                                                    |         |
| `--buildLibsFromSource`          | boolean | Read buildable libraries from source instead of building them separately. If set to `false`, the `tsConfig` option must also be set to remap paths.                                                                                          | `true`  |
| `--deployUrl`                    | string  | URL where the application will be deployed.                                                                                                                                                                                                  |         |
| `--externalDependencies`         | string  | Dependencies to keep external to the bundle. (`all` (default), `none`, or an array of module names)                                                                                                                                          |         |
| `--extractCss`                   | boolean | Extract CSS into a `.css` file.                                                                                                                                                                                                              |         |
| `--extractLicenses`              | boolean | Extract all licenses in a separate file.                                                                                                                                                                                                     | `false` |
| `--fileReplacements`             | array   | Replace files with other files in the build.                                                                                                                                                                                                 | `[]`    |
| `--generateIndexHtml`            | boolean | Generates `index.html` file to the output path. This can be turned off if using a webpack plugin to generate HTML such as `html-webpack-plugin`.                                                                                             |         |
| `--generatePackageJson`          | boolean | Generates a `package.json` and pruned lock file with the project's `node_module` dependencies populated for installing in a container. If a `package.json` exists in the project's directory, it will be reused with dependencies populated. |         |
| `--index`                        | string  | HTML File which will be contain the application.                                                                                                                                                                                             |         |
| `--main`                         | string  | The main entry file.                                                                                                                                                                                                                         |         |
| `--memoryLimit`                  | number  | Memory limit for type checking service process in `MB`.                                                                                                                                                                                      |         |
| `--mode`                         | string  | Mode to run the build in.                                                                                                                                                                                                                    |         |
| `--namedChunks`                  | boolean | Names the produced bundles according to their entry file.                                                                                                                                                                                    |         |
| `--optimization`                 | string  | Enables optimization of the build output.                                                                                                                                                                                                    |         |
| `--outputFileName`               | string  | The main output entry file                                                                                                                                                                                                                   |         |
| `--outputHashing`                | string  | Define the output filename cache-busting hashing mode.                                                                                                                                                                                       |         |
| `--outputPath`                   | string  | The output path for the bundle.                                                                                                                                                                                                              |         |
| `--poll`                         | number  | Enable and define the file watching poll time period.                                                                                                                                                                                        |         |
| `--polyfills`                    | string  | Polyfills to load before application                                                                                                                                                                                                         |         |
| `--postcssConfig`                | string  | Set a path to PostCSS config that applies to the app and all libs. Defaults to `undefined`, which auto-detects postcss.config.js files in each `app`/`lib` directory.                                                                        |         |
| `--progress`                     | boolean | Log progress to the console while building.                                                                                                                                                                                                  |         |
| `--publicPath`                   | string  | Set a public path for assets resources with absolute paths.                                                                                                                                                                                  |         |
| `--rebaseRootRelative`           | boolean | Whether to rebase absolute path for assets in postcss cli resources.                                                                                                                                                                         |         |
| `--runtimeChunk`                 | boolean | Use a separate bundle containing the runtime.                                                                                                                                                                                                |         |
| `--sassImplementation`           | string  | The implementation of the SASS compiler to use. Can be either `sass` or `sass-embedded`. Defaults to `sass-embedded`.                                                                                                                        | `sass`  |
| `--scripts`                      | array   | External Scripts which will be included before the main application entry.                                                                                                                                                                   |         |
| `--skipTypeChecking`             | boolean | Skip the type checking. Default is `false`.                                                                                                                                                                                                  |         |
| `--sourceMap`                    | string  | Output sourcemaps. Use 'hidden' for use with error reporting tools without generating sourcemap comment.                                                                                                                                     | `true`  |
| `--standardRspackConfigFunction` | boolean | Set to true if the rspack config exports a standard rspack function, not an Nx-specific one. See: https://rspack.dev/config/                                                                                                                 | `false` |
| `--statsJson`                    | boolean | Generates a 'stats.json' file which can be analyzed using tools such as: 'webpack-bundle-analyzer' See: https://rspack.dev/guide/optimization/analysis                                                                                       |         |
| `--stylePreprocessorOptions`     | object  | Options to pass to style preprocessors.                                                                                                                                                                                                      |         |
| `--styles`                       | array   | External Styles which will be included with the application                                                                                                                                                                                  |         |
| `--target`                       | string  | The platform to target (e.g. web, node).                                                                                                                                                                                                     |         |
| `--transformers`                 | array   | List of TypeScript Compiler Transfomers Plugins.                                                                                                                                                                                             |         |
| `--tsConfig`                     | string  | The tsconfig file to build the project.                                                                                                                                                                                                      |         |
| `--vendorChunk`                  | boolean | Use a separate bundle containing only vendor libraries.                                                                                                                                                                                      |         |

### `ssr-dev-server`

Serve a SSR application using rspack.

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

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
