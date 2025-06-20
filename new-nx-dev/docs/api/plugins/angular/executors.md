---
title: '@nx/angular Executors'
description: 'Complete reference for all @nx/angular executor commands'
sidebar_label: Executors
---

# @nx/angular Executors

The @nx/angular plugin provides various executors to run tasks on your angular projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `application`

Builds an Angular application using [esbuild](https://esbuild.github.io/) with integrated SSR and prerendering capabilities.

**Usage:**

```bash
nx run &lt;project&gt;:application [options]
```

#### Options

| Option                          | Type    | Description                                                                                                                                                                                                                                                                                                                                      | Default   |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `--outputPath` **[required]**   | string  | Specify the output path relative to workspace root.                                                                                                                                                                                                                                                                                              |           |
| `--tsConfig` **[required]**     | string  | The full path for the TypeScript configuration file, relative to the current workspace.                                                                                                                                                                                                                                                          |           |
| `--allowedCommonJsDependencies` | array   | A list of CommonJS or AMD packages that are allowed to be used without a build time warning. Use `'*'` to allow all.                                                                                                                                                                                                                             | `[]`      |
| `--aot`                         | boolean | Build using Ahead of Time compilation.                                                                                                                                                                                                                                                                                                           | `true`    |
| `--appShell`                    | boolean | Generates an application shell during build time. It defaults to `false` in Angular versions &lt; 19.0.0. Otherwise, the value will be `undefined`.                                                                                                                                                                                              |           |
| `--assets`                      | array   | List of static application assets.                                                                                                                                                                                                                                                                                                               | `[]`      |
| `--baseHref`                    | string  | Base url for the application being built.                                                                                                                                                                                                                                                                                                        |           |
| `--browser`                     | string  | The full path for the browser entry point to the application, relative to the current workspace.                                                                                                                                                                                                                                                 |           |
| `--budgets`                     | array   | Budget thresholds to ensure parts of your application stay within boundaries which you set.                                                                                                                                                                                                                                                      | `[]`      |
| `--buildLibsFromSource`         | boolean | Read buildable libraries from source instead of building them separately.                                                                                                                                                                                                                                                                        | `true`    |
| `--clearScreen`                 | boolean | Automatically clear the terminal screen during rebuilds.                                                                                                                                                                                                                                                                                         | `false`   |
| `--conditions`                  | array   | Custom package resolution conditions used to resolve conditional exports/imports. Defaults to ['module', 'development'/'production']. The following special conditions are always present if the requirements are satisfied: 'default', 'import', 'require', 'browser', 'node'. _Note: this is only supported in Angular versions &gt;= 20.0.0_. |           |
| `--crossOrigin`                 | string  | Define the crossorigin attribute setting of elements that provide CORS support.                                                                                                                                                                                                                                                                  | `none`    |
| `--define`                      | object  | Defines global identifiers that will be replaced with a specified constant value when found in any JavaScript or TypeScript code including libraries. The value will be used directly. String values must be put in quotes. Identifiers within Angular metadata such as Component Decorators will not be replaced.                               |           |
| `--deleteOutputPath`            | boolean | Delete the output path before building.                                                                                                                                                                                                                                                                                                          | `true`    |
| `--deployUrl`                   | string  | Customize the base path for the URLs of resources in 'index.html' and component stylesheets. This option is only necessary for specific deployment scenarios, such as with Angular Elements or when utilizing different CDN locations.                                                                                                           |           |
| `--externalDependencies`        | array   | Exclude the listed external dependencies from being bundled into the bundle. Instead, the created bundle relies on these dependencies to be available during runtime.                                                                                                                                                                            | `[]`      |
| `--extractLicenses`             | boolean | Extract all licenses in a separate file.                                                                                                                                                                                                                                                                                                         | `true`    |
| `--fileReplacements`            | array   | Replace compilation source files with other compilation source files in the build.                                                                                                                                                                                                                                                               | `[]`      |
| `--i18nDuplicateTranslation`    | string  | How to handle duplicate translations for i18n.                                                                                                                                                                                                                                                                                                   | `warning` |
| `--i18nMissingTranslation`      | string  | How to handle missing translations for i18n.                                                                                                                                                                                                                                                                                                     | `warning` |
| `--index`                       | string  | Configures the generation of the application's HTML index.                                                                                                                                                                                                                                                                                       |           |
| `--indexHtmlTransformer`        | string  | Path to a file exposing a default function to transform the `index.html` file.                                                                                                                                                                                                                                                                   |           |
| `--inlineStyleLanguage`         | string  | The stylesheet language to use for the application's inline component styles.                                                                                                                                                                                                                                                                    | `css`     |
| `--loader`                      | object  | Defines the type of loader to use with a specified file extension when used with a JavaScript `import`. `text` inlines the content as a string; `binary` inlines the content as a Uint8Array; `file` emits the file and provides the runtime location of the file; `empty` considers the content to be empty and not include it in bundles.      |           |
| `--localize`                    | string  | Translate the bundles in one or more locales.                                                                                                                                                                                                                                                                                                    |           |
| `--namedChunks`                 | boolean | Use file name for lazy loaded chunks.                                                                                                                                                                                                                                                                                                            | `false`   |
| `--optimization`                | string  | Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, inlining of critical CSS and fonts inlining. For more information, see https://angular.dev/reference/configs/workspace-config#optimization-configuration.                                                           | `true`    |
| `--outputHashing`               | string  | Define the output filename cache-busting hashing mode.                                                                                                                                                                                                                                                                                           | `none`    |
| `--outputMode`                  | string  | Defines the build output target. 'static': Generates a static site for deployment on any static hosting service. 'server': Produces an application designed for deployment on a server that supports server-side rendering (SSR). _Note: this is only supported in Angular versions &gt;= 19.0.0_.                                               |           |
| `--plugins`                     | array   | A list of ESBuild plugins.                                                                                                                                                                                                                                                                                                                       |           |
| `--poll`                        | number  | Enable and define the file watching poll time period in milliseconds.                                                                                                                                                                                                                                                                            |           |
| `--polyfills`                   | array   | A list of polyfills to include in the build. Can be a full path for a file, relative to the current workspace or module specifier. Example: 'zone.js'.                                                                                                                                                                                           | `[]`      |
| `--prerender`                   | string  | Prerender (SSG) pages of your application during build time. It defaults to `false` in Angular versions &lt; 19.0.0. Otherwise, the value will be `undefined`.                                                                                                                                                                                   |           |
| `--preserveSymlinks`            | boolean | Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set.                                                                                                                                                                                                               |           |
| `--progress`                    | boolean | Log progress to the console while building.                                                                                                                                                                                                                                                                                                      | `true`    |
| `--scripts`                     | array   | Global scripts to be included in the build.                                                                                                                                                                                                                                                                                                      | `[]`      |
| `--security`                    | object  | Security features to protect against XSS and other common attacks. _Note: this is only supported in Angular versions &gt;= 19.0.0_.                                                                                                                                                                                                              |           |
| `--server`                      | string  | The full path for the server entry point to the application, relative to the current workspace.                                                                                                                                                                                                                                                  |           |
| `--serviceWorker`               | string  | Generates a service worker configuration.                                                                                                                                                                                                                                                                                                        | `false`   |
| `--sourceMap`                   | string  | Output source maps for scripts and styles. For more information, see https://angular.dev/reference/configs/workspace-config#source-map-configuration.                                                                                                                                                                                            | `false`   |
| `--ssr`                         | string  | Server side render (SSR) pages of your application during runtime.                                                                                                                                                                                                                                                                               | `false`   |
| `--statsJson`                   | boolean | Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/.                                                                                                                                                                                                                                                     | `false`   |
| `--stylePreprocessorOptions`    | object  | Options to pass to style preprocessors.                                                                                                                                                                                                                                                                                                          |           |
| `--styles`                      | array   | Global styles to be included in the build.                                                                                                                                                                                                                                                                                                       | `[]`      |
| `--subresourceIntegrity`        | boolean | Enables the use of subresource integrity validation.                                                                                                                                                                                                                                                                                             | `false`   |
| `--verbose`                     | boolean | Adds more details to output logging.                                                                                                                                                                                                                                                                                                             | `false`   |
| `--watch`                       | boolean | Run build when files change.                                                                                                                                                                                                                                                                                                                     | `false`   |
| `--webWorkerTsConfig`           | string  | TypeScript configuration for Web Worker modules.                                                                                                                                                                                                                                                                                                 |           |

### `browser-esbuild`

Builds an Angular application using [esbuild](https://esbuild.github.io/).

**Usage:**

```bash
nx run &lt;project&gt;:browser-esbuild [options]
```

#### Options

| Option                          | Type    | Description                                                                                                                                                                                                                                                                            | Default   |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--index` **[required]**        | string  | Configures the generation of the application's HTML index.                                                                                                                                                                                                                             |           |
| `--main` **[required]**         | string  | The full path for the main entry point to the app, relative to the current workspace.                                                                                                                                                                                                  |           |
| `--outputPath` **[required]**   | string  | The full path for the new output directory, relative to the current workspace.                                                                                                                                                                                                         |           |
| `--tsConfig` **[required]**     | string  | The full path for the TypeScript configuration file, relative to the current workspace.                                                                                                                                                                                                |           |
| `--allowedCommonJsDependencies` | array   | A list of CommonJS or AMD packages that are allowed to be used without a build time warning. Use `'*'` to allow all.                                                                                                                                                                   | `[]`      |
| `--aot`                         | boolean | Build using Ahead of Time compilation.                                                                                                                                                                                                                                                 | `true`    |
| `--assets`                      | array   | List of static application assets.                                                                                                                                                                                                                                                     | `[]`      |
| `--baseHref`                    | string  | Base url for the application being built.                                                                                                                                                                                                                                              |           |
| `--budgets`                     | array   | Budget thresholds to ensure parts of your application stay within boundaries which you set.                                                                                                                                                                                            | `[]`      |
| `--buildLibsFromSource`         | boolean | Read buildable libraries from source instead of building them separately.                                                                                                                                                                                                              | `true`    |
| `--buildOptimizer`              | boolean | Enables advanced build optimizations when using the 'aot' option.                                                                                                                                                                                                                      | `true`    |
| `--commonChunk`                 | boolean | Generate a separate bundle containing code used across multiple bundles.                                                                                                                                                                                                               | `true`    |
| `--crossOrigin`                 | string  | Define the crossorigin attribute setting of elements that provide CORS support.                                                                                                                                                                                                        | `none`    |
| `--deleteOutputPath`            | boolean | Delete the output path before building.                                                                                                                                                                                                                                                | `true`    |
| `--deployUrl`                   | string  | Customize the base path for the URLs of resources in 'index.html' and component stylesheets. This option is only necessary for specific deployment scenarios, such as with Angular Elements or when utilizing different CDN locations.                                                 |           |
| `--externalDependencies`        | array   | Exclude the listed external dependencies from being bundled into the bundle. Instead, the created bundle relies on these dependencies to be available during runtime.                                                                                                                  | `[]`      |
| `--extractLicenses`             | boolean | Extract all licenses in a separate file.                                                                                                                                                                                                                                               | `true`    |
| `--fileReplacements`            | array   | Replace compilation source files with other compilation source files in the build.                                                                                                                                                                                                     | `[]`      |
| `--i18nDuplicateTranslation`    | string  | How to handle duplicate translations for i18n.                                                                                                                                                                                                                                         | `warning` |
| `--i18nMissingTranslation`      | string  | How to handle missing translations for i18n.                                                                                                                                                                                                                                           | `warning` |
| `--inlineStyleLanguage`         | string  | The stylesheet language to use for the application's inline component styles.                                                                                                                                                                                                          | `css`     |
| `--localize`                    | string  | Translate the bundles in one or more locales.                                                                                                                                                                                                                                          |           |
| `--namedChunks`                 | boolean | Use file name for lazy loaded chunks.                                                                                                                                                                                                                                                  | `false`   |
| `--ngswConfigPath`              | string  | Path to ngsw-config.json.                                                                                                                                                                                                                                                              |           |
| `--optimization`                | string  | Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, inlining of critical CSS and fonts inlining. For more information, see https://angular.dev/reference/configs/workspace-config#optimization-configuration. | `true`    |
| `--outputHashing`               | string  | Define the output filename cache-busting hashing mode.                                                                                                                                                                                                                                 | `none`    |
| `--plugins`                     | array   | A list of ESBuild plugins.                                                                                                                                                                                                                                                             |           |
| `--poll`                        | number  | Enable and define the file watching poll time period in milliseconds.                                                                                                                                                                                                                  |           |
| `--polyfills`                   | string  | Polyfills to be included in the build.                                                                                                                                                                                                                                                 |           |
| `--preserveSymlinks`            | boolean | Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set.                                                                                                                                                     |           |
| `--progress`                    | boolean | Log progress to the console while building.                                                                                                                                                                                                                                            | `true`    |
| `--resourcesOutputPath`         | string  | The path where style resources will be placed, relative to outputPath.                                                                                                                                                                                                                 |           |
| `--scripts`                     | array   | Global scripts to be included in the build.                                                                                                                                                                                                                                            | `[]`      |
| `--serviceWorker`               | boolean | Generates a service worker config for production builds.                                                                                                                                                                                                                               | `false`   |
| `--sourceMap`                   | string  | Output source maps for scripts and styles. For more information, see https://angular.dev/reference/configs/workspace-config#source-map-configuration.                                                                                                                                  | `false`   |
| `--statsJson`                   | boolean | Generates a 'stats.json' file which can be analyzed using tools such as 'webpack-bundle-analyzer'.                                                                                                                                                                                     | `false`   |
| `--stylePreprocessorOptions`    | object  | Options to pass to style preprocessors.                                                                                                                                                                                                                                                |           |
| `--styles`                      | array   | Global styles to be included in the build.                                                                                                                                                                                                                                             | `[]`      |
| `--subresourceIntegrity`        | boolean | Enables the use of subresource integrity validation.                                                                                                                                                                                                                                   | `false`   |
| `--vendorChunk`                 | boolean | Generate a separate bundle containing only vendor libraries. This option should only be used for development to reduce the incremental compilation time.                                                                                                                               | `false`   |
| `--verbose`                     | boolean | Adds more details to output logging.                                                                                                                                                                                                                                                   | `false`   |
| `--watch`                       | boolean | Run build when files change.                                                                                                                                                                                                                                                           | `false`   |
| `--webWorkerTsConfig`           | string  | TypeScript configuration for Web Worker modules.                                                                                                                                                                                                                                       |           |

### `delegate-build`

Delegates the build to a different target while supporting incremental builds.

**Usage:**

```bash
nx run &lt;project&gt;:delegate-build [options]
```

#### Options

| Option                         | Type    | Description                                                                            | Default |
| ------------------------------ | ------- | -------------------------------------------------------------------------------------- | ------- |
| `--buildTarget` **[required]** | string  | Build target used for building the application after its dependencies have been built. |         |
| `--outputPath` **[required]**  | string  | The full path for the output directory, relative to the workspace root.                |         |
| `--tsConfig` **[required]**    | string  | The full path for the TypeScript configuration file, relative to the workspace root.   |         |
| `--watch`                      | boolean | Whether to run a build when any file changes.                                          | `false` |

### `extract-i18n`

Extracts i18n messages from source code.

**Usage:**

```bash
nx run &lt;project&gt;:extract-i18n [options]
```

#### Options

| Option                         | Type    | Description                                                                                                                                                                                                                 | Default |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildTarget` **[required]** | string  | A builder target to extract i18n messages in the format of `project:target[:configuration]`. You can also pass in more than one configuration name as a comma-separated list. Example: `project:target:production,staging`. |         |
| `--format`                     | string  | Output format for the generated file.                                                                                                                                                                                       | `xlf`   |
| `--i18nDuplicateTranslation`   | string  | How to handle duplicate translations. _Note: this is only available in Angular 20.0.0 and above._                                                                                                                           |         |
| `--outFile`                    | string  | Name of the file to output.                                                                                                                                                                                                 |         |
| `--outputPath`                 | string  | Path where output will be placed.                                                                                                                                                                                           |         |
| `--progress`                   | boolean | Log progress to the console.                                                                                                                                                                                                | `true`  |

### `module-federation-dev-server`

Serves host [Module Federation](https://module-federation.io/) applications ([webpack](https://webpack.js.org/)-based) allowing to specify which remote applications should be served with the host.

**Usage:**

```bash
nx run &lt;project&gt;:module-federation-dev-server [options]
```

#### Options

| Option                         | Type    | Description                                                                                                                                                                                                                                      | Default     |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `--buildTarget` **[required]** | string  | A build builder target to serve in the format of `project:target[:configuration]`.                                                                                                                                                               |             |
| `--allowedHosts`               | array   | List of hosts that are allowed to access the dev server.                                                                                                                                                                                         | `[]`        |
| `--buildLibsFromSource`        | boolean | Read buildable libraries from source instead of building them separately. If not set, it will take the value specified in the `buildTarget` options, or it will default to `true` if it's also not set in the `buildTarget` options.             |             |
| `--devRemotes`                 | array   | List of remote applications to run in development mode (i.e. using serve target).                                                                                                                                                                |             |
| `--disableHostCheck`           | boolean | Don't verify connected clients are part of allowed hosts.                                                                                                                                                                                        | `false`     |
| `--headers`                    | object  | Custom HTTP headers to be added to all responses.                                                                                                                                                                                                |             |
| `--hmr`                        | boolean | Enable hot module replacement.                                                                                                                                                                                                                   | `false`     |
| `--host`                       | string  | Host to listen on.                                                                                                                                                                                                                               | `localhost` |
| `--isInitialHost`              | boolean | Whether the host that is running this executor is the first in the project tree to do so.                                                                                                                                                        | `true`      |
| `--liveReload`                 | boolean | Whether to reload the page on change, using live-reload.                                                                                                                                                                                         | `true`      |
| `--open`                       | boolean | Opens the url in default browser.                                                                                                                                                                                                                | `false`     |
| `--parallel`                   | number  | Max number of parallel processes for building static remotes                                                                                                                                                                                     |             |
| `--pathToManifestFile`         | string  | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic remote applications relative to the workspace root.                                                                         |             |
| `--poll`                       | number  | Enable and define the file watching poll time period in milliseconds.                                                                                                                                                                            |             |
| `--port`                       | number  | Port to listen on.                                                                                                                                                                                                                               | `4200`      |
| `--proxyConfig`                | string  | Proxy configuration file. For more information, see https://angular.dev/tools/cli/serve#proxying-to-a-backend-server.                                                                                                                            |             |
| `--publicHost`                 | string  | The URL that the browser client (or live-reload client, if enabled) should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies.                                                       |             |
| `--servePath`                  | string  | The pathname where the app will be served.                                                                                                                                                                                                       |             |
| `--skipRemotes`                | array   | List of remote applications to not automatically serve, either statically or in development mode. This will not remove the remotes from the `module-federation.config` file, and therefore the application may still try to fetch these remotes. |

This option is useful if you have other means for serving the `remote` application(s).
**NOTE:** Remotes that are not in the workspace will be skipped automatically. | |
| `--ssl` | boolean | Serve using HTTPS. | `false` |
| `--sslCert` | string | SSL certificate to use for serving HTTPS. | |
| `--sslKey` | string | SSL key to use for serving HTTPS. | |
| `--static` | boolean | Whether to use a static file server instead of the webpack-dev-server. This should be used for remote applications that are also host applications. | |
| `--staticRemotesPort` | number | The port at which to serve the file-server for the static remotes. | |
| `--verbose` | boolean | Adds more details to output logging. | |
| `--watch` | boolean | Rebuild on change. | `true` |

### `module-federation-dev-ssr`

The module-federation-ssr-dev-server executor is reserved exclusively for use with host SSR Module Federation applications. It allows the user to specify which remote applications should be served with the host.

**Usage:**

```bash
nx run &lt;project&gt;:module-federation-dev-ssr [options]
```

#### Options

| Option                           | Type    | Description                                                                                                                                                              | Default     |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `--browserTarget` **[required]** | string  | Browser target to build.                                                                                                                                                 |             |
| `--serverTarget` **[required]**  | string  | Server target to build.                                                                                                                                                  |             |
| `--devRemotes`                   | array   | List of remote applications to run in development mode (i.e. using serve target).                                                                                        |             |
| `--host`                         | string  | Host to listen on.                                                                                                                                                       | `localhost` |
| `--inspect`                      | boolean | Launch the development server in inspector mode and listen on address and port '127.0.0.1:9229'.                                                                         | `false`     |
| `--isInitialHost`                | boolean | Whether the host that is running this executor is the first in the project tree to do so.                                                                                | `true`      |
| `--open`                         | boolean | Opens the url in default browser.                                                                                                                                        | `false`     |
| `--parallel`                     | number  | Max number of parallel processes for building static remotes                                                                                                             |             |
| `--pathToManifestFile`           | string  | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic remote applications relative to the workspace root. |             |
| `--port`                         | number  | Port to start the development server at. Default is 4200. Pass 0 to get a dynamically assigned port.                                                                     | `4200`      |
| `--progress`                     | boolean | Log progress to the console while building.                                                                                                                              |             |
| `--proxyConfig`                  | string  | Proxy configuration file.                                                                                                                                                |             |
| `--publicHost`                   | string  | The URL that the browser client should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies.                   |             |
| `--skipRemotes`                  | array   | List of remote applications to not automatically serve, either statically or in development mode.                                                                        |             |
| `--ssl`                          | boolean | Serve using HTTPS.                                                                                                                                                       | `false`     |
| `--sslCert`                      | string  | SSL certificate to use for serving HTTPS.                                                                                                                                |             |
| `--sslKey`                       | string  | SSL key to use for serving HTTPS.                                                                                                                                        |             |
| `--staticRemotesPort`            | number  | The port at which to serve the file-server for the static remotes.                                                                                                       |             |
| `--verbose`                      | boolean | Adds more details to output logging.                                                                                                                                     | `false`     |

### `ng-packagr-lite`

Builds an Angular library with support for incremental builds.

This executor is meant to be used with buildable libraries in an incremental build scenario. It is similar to the `@nx/angular:package` executor but it only produces ESM2022 bundles.

**Usage:**

```bash
nx run &lt;project&gt;:ng-packagr-lite [options]
```

#### Options

| Option       | Type    | Description                                                                          | Default |
| ------------ | ------- | ------------------------------------------------------------------------------------ | ------- |
| `--poll`     | number  | Enable and define the file watching poll time period in milliseconds.                |         |
| `--project`  | string  | The file path for the ng-packagr configuration file, relative to the workspace root. |         |
| `--tsConfig` | string  | The full path for the TypeScript configuration file, relative to the workspace root. |         |
| `--watch`    | boolean | Whether to run a build when any file changes.                                        | `false` |

### `package`

Builds and packages an Angular library producing an output following the Angular Package Format (APF) to be distributed as an NPM package.

This executor is a drop-in replacement for the `@angular-devkit/build-angular:ng-packagr` and `@angular/build:ng-packagr` builders, with additional support for incremental builds.

**Usage:**

```bash
nx run &lt;project&gt;:package [options]
```

#### Options

| Option       | Type    | Description                                                                          | Default |
| ------------ | ------- | ------------------------------------------------------------------------------------ | ------- |
| `--poll`     | number  | Enable and define the file watching poll time period in milliseconds.                |         |
| `--project`  | string  | The file path for the ng-packagr configuration file, relative to the workspace root. |         |
| `--tsConfig` | string  | The full path for the TypeScript configuration file, relative to the workspace root. |         |
| `--watch`    | boolean | Whether to run a build when any file changes.                                        | `false` |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
