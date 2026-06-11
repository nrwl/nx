
  The @nx/angular plugin provides various executors to help you create and configure angular projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `application`
Builds an Angular application using [esbuild](https://esbuild.github.io/) with integrated SSR and prerendering capabilities.

This executor is a drop-in replacement for the `@angular-devkit/build-angular:application` builder provided by the Angular CLI. It builds an Angular application using [esbuild](https://esbuild.github.io/) with integrated SSR and prerendering capabilities.

In addition to the features provided by the Angular CLI builder, the `@nx/angular:application` executor also supports the following:

- Providing esbuild plugins
- Providing a function to transform the application's `index.html` file
- Incremental builds

:::tip[Dev Server]
The [`@nx/angular:dev-server` executor](/nx-api/angular/executors/dev-server) is required to serve your application when using the `@nx/angular:application` to build it. It is a drop-in replacement for the Angular CLI's `@angular-devkit/build-angular:dev-server` builder and ensures the application is correctly served with Vite when using the `@nx/angular:application` executor.
:::

### Examples

###### Providing esbuild plugins

The executor accepts a `plugins` option that allows you to provide esbuild plugins that will be used when building your application. It allows providing a path to a plugin file or an object with a `path` and `options` property to provide options to the plugin.

```json title="apps/my-app/project.json" {8-16}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "plugins": [
          "apps/my-app/plugins/plugin1.js",
          {
            "path": "apps/my-app/plugins/plugin2.js",
            "options": {
              "someOption": "some value"
            }
          }
        ]
      }
    }
    ...
  }
}
```

```ts title="apps/my-app/plugins/plugin1.js"
const plugin1 = {
  name: 'plugin1',
  setup(build) {
    const options = build.initialOptions;
    options.define.PLUGIN1_TEXT = '"Value was provided at build time"';
  },
};

module.exports = plugin1;
```

```ts title="apps/my-app/plugins/plugin2.js"
function plugin2({ someOption }) {
  return {
    name: 'plugin2',
    setup(build) {
      const options = build.initialOptions;
      options.define.PLUGIN2_TEXT = JSON.stringify(someOption);
    },
  };
}

module.exports = plugin2;
```

Additionally, we need to inform TypeScript of the defined variables to prevent type-checking errors during the build. We can achieve this by creating or updating a type definition file included in the TypeScript build process (e.g. `src/types.d.ts`) with the following content:

```ts title="apps/my-app/src/types.d.ts"
declare const PLUGIN1_TEXT: number;
declare const PLUGIN2_TEXT: string;
```

###### Transforming the 'index.html' file

The executor accepts an `indexHtmlTransformer` option to provide a path to a file with a default export for a function that receives the application's `index.html` file contents and outputs the updated contents.

```json title="apps/my-app/project.json" {8}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {
        ...
        "indexHtmlTransformer": "apps/my-app/index-html.transformer.ts"
      }
    }
    ...
  }
}
```

```ts title="apps/my-app/index-html.transformer.ts"
export default function (indexContent: string) {
  return indexContent.replace(
    '<title>my-app</title>',
    '<title>my-app (transformed)</title>'
  );
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `outputPath` | string [**required**] | Specify the output path relative to workspace root. |  |
| `tsConfig` | string [**required**] | The full path for the TypeScript configuration file, relative to the current workspace. |  |
| `allowedCommonJsDependencies` | array | A list of CommonJS or AMD packages that are allowed to be used without a build time warning. Use `'*'` to allow all. | `[]` |
| `aot` | boolean | Build using Ahead of Time compilation. | `true` |
| `appShell` | boolean | Generates an application shell during build time. |  |
| `assets` | array | List of static application assets. | `[]` |
| `baseHref` | string | Base url for the application being built. |  |
| `browser` | string | The full path for the browser entry point to the application, relative to the current workspace. |  |
| `budgets` | array | Budget thresholds to ensure parts of your application stay within boundaries which you set. | `[]` |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `clearScreen` | boolean | Automatically clear the terminal screen during rebuilds. | `false` |
| `conditions` | array | Custom package resolution conditions used to resolve conditional exports/imports. Defaults to ['module', 'development'/'production']. The following special conditions are always present if the requirements are satisfied: 'default', 'import', 'require', 'browser', 'node'. _Note: this is only supported in Angular versions >= 20.0.0_. |  |
| `crossOrigin` | string | Define the crossorigin attribute setting of elements that provide CORS support. | `"none"` |
| `define` | object | Defines global identifiers that will be replaced with a specified constant value when found in any JavaScript or TypeScript code including libraries. The value will be used directly. String values must be put in quotes. Identifiers within Angular metadata such as Component Decorators will not be replaced. |  |
| `deleteOutputPath` | boolean | Delete the output path before building. | `true` |
| `deployUrl` | string | Customize the base path for the URLs of resources in 'index.html' and component stylesheets. This option is only necessary for specific deployment scenarios, such as with Angular Elements or when utilizing different CDN locations. |  |
| `externalDependencies` | array | Exclude the listed external dependencies from being bundled into the bundle. Instead, the created bundle relies on these dependencies to be available during runtime. | `[]` |
| `extractLicenses` | boolean | Extract all licenses in a separate file. | `true` |
| `fileReplacements` | array | Replace compilation source files with other compilation source files in the build. | `[]` |
| `i18nDuplicateTranslation` | string | How to handle duplicate translations for i18n. | `"warning"` |
| `i18nMissingTranslation` | string | How to handle missing translations for i18n. | `"warning"` |
| `index` | string | Configures the generation of the application's HTML index. |  |
| `indexHtmlTransformer` | string | Path to a file exposing a default function to transform the `index.html` file. |  |
| `inlineStyleLanguage` | string | The stylesheet language to use for the application's inline component styles. | `"css"` |
| `loader` | object | Defines the type of loader to use with a specified file extension when used with a JavaScript `import`. `text` inlines the content as a string; `binary` inlines the content as a Uint8Array; `file` emits the file and provides the runtime location of the file; `dataurl` inlines the content as a data URL with best guess of MIME type; `base64` inlines the content as a Base64-encoded string; `empty` considers the content to be empty and not include it in bundles. _Note: `dataurl` and `base64` are only supported in Angular versions >= 20.1.0_. |  |
| `localize` | string | Translate the bundles in one or more locales. |  |
| `namedChunks` | boolean | Use file name for lazy loaded chunks. | `false` |
| `optimization` | string | Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, inlining of critical CSS and fonts inlining. For more information, see https://angular.dev/reference/configs/workspace-config#optimization-configuration. | `true` |
| `outputHashing` | string | Define the output filename cache-busting hashing mode. | `"none"` |
| `outputMode` | string | Defines the build output target. 'static': Generates a static site for deployment on any static hosting service. 'server': Produces an application designed for deployment on a server that supports server-side rendering (SSR). |  |
| `plugins` | array | A list of ESBuild plugins. |  |
| `poll` | number | Enable and define the file watching poll time period in milliseconds. |  |
| `polyfills` | array | A list of polyfills to include in the build. Can be a full path for a file, relative to the current workspace or module specifier. Example: 'zone.js'. | `[]` |
| `prerender` | string | Prerender (SSG) pages of your application during build time. |  |
| `preserveSymlinks` | boolean | Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set. |  |
| `progress` | boolean | Log progress to the console while building. | `true` |
| `scripts` | array | Global scripts to be included in the build. | `[]` |
| `security` | object | Security features to protect against XSS and other common attacks |  |
| `server` | string | The full path for the server entry point to the application, relative to the current workspace. |  |
| `serviceWorker` | string | Generates a service worker configuration. | `false` |
| `sourceMap` | string | Output source maps for scripts and styles. For more information, see https://angular.dev/reference/configs/workspace-config#source-map-configuration. | `false` |
| `ssr` | string | Server side render (SSR) pages of your application during runtime. | `false` |
| `statsJson` | boolean | Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/. | `false` |
| `stylePreprocessorOptions` | object | Options to pass to style preprocessors. |  |
| `styles` | array | Global styles to be included in the build. | `[]` |
| `subresourceIntegrity` | boolean | Enables the use of subresource integrity validation. | `false` |
| `verbose` | boolean | Adds more details to output logging. | `false` |
| `watch` | boolean | Run build when files change. | `false` |
| `webWorkerTsConfig` | string | TypeScript configuration for Web Worker modules. |  |

### `browser-esbuild`
Builds an Angular application using [esbuild](https://esbuild.github.io/).

This executor is a drop-in replacement for the `@angular-devkit/build-angular:browser-esbuild` builder provided by the Angular CLI. It builds an Angular application using esbuild.

In addition to the features provided by the Angular CLI builder, the `@nx/angular:browser-esbuild` executor also supports the following:

- Providing esbuild plugins
- Incremental builds

:::tip[Dev Server]
The [`@nx/angular:dev-server` executor](/nx-api/angular/executors/dev-server) is required to serve your application when using the `@nx/angular:browser-esbuild` to build it. It is a drop-in replacement for the Angular CLI's `@angular-devkit/build-angular:dev-server` builder and ensures the application is correctly served with Vite when using the `@nx/angular:browser-esbuild` executor.
:::

### Examples

###### Providing esbuild plugins

The executor accepts a `plugins` option that allows you to provide esbuild plugins that will be used when building your application. It allows providing a path to a plugin file or an object with a `path` and `options` property to provide options to the plugin.

```json title="apps/my-app/project.json" {8-16}
{
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:browser-esbuild",
      "options": {
        ...
        "plugins": [
          "apps/my-app/plugins/plugin1.js",
          {
            "path": "apps/my-app/plugins/plugin2.js",
            "options": {
              "someOption": "some value"
            }
          }
        ]
      }
    }
    ...
  }
}
```

```ts title="apps/my-app/plugins/plugin1.js"
const plugin1 = {
  name: 'plugin1',
  setup(build) {
    const options = build.initialOptions;
    options.define.PLUGIN1_TEXT = '"Value was provided at build time"';
  },
};

module.exports = plugin1;
```

```ts title="apps/my-app/plugins/plugin2.js"
function plugin2({ someOption }) {
  return {
    name: 'plugin2',
    setup(build) {
      const options = build.initialOptions;
      options.define.PLUGIN2_TEXT = JSON.stringify(someOption);
    },
  };
}

module.exports = plugin2;
```

Additionally, we need to inform TypeScript of the defined variables to prevent type-checking errors during the build. We can achieve this by creating or updating a type definition file included in the TypeScript build process (e.g. `src/types.d.ts`) with the following content:

```ts title="apps/my-app/src/types.d.ts"
declare const PLUGIN1_TEXT: number;
declare const PLUGIN2_TEXT: string;
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `index` | string [**required**] | Configures the generation of the application's HTML index. |  |
| `main` | string [**required**] | The full path for the main entry point to the app, relative to the current workspace. |  |
| `outputPath` | string [**required**] | The full path for the new output directory, relative to the current workspace. |  |
| `tsConfig` | string [**required**] | The full path for the TypeScript configuration file, relative to the current workspace. |  |
| `allowedCommonJsDependencies` | array | A list of CommonJS or AMD packages that are allowed to be used without a build time warning. Use `'*'` to allow all. | `[]` |
| `aot` | boolean | Build using Ahead of Time compilation. | `true` |
| `assets` | array | List of static application assets. | `[]` |
| `baseHref` | string | Base url for the application being built. |  |
| `budgets` | array | Budget thresholds to ensure parts of your application stay within boundaries which you set. | `[]` |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. | `true` |
| `buildOptimizer` | boolean | Enables advanced build optimizations when using the 'aot' option. | `true` |
| `commonChunk` | boolean | Generate a separate bundle containing code used across multiple bundles. | `true` |
| `crossOrigin` | string | Define the crossorigin attribute setting of elements that provide CORS support. | `"none"` |
| `deleteOutputPath` | boolean | Delete the output path before building. | `true` |
| `deployUrl` | string | Customize the base path for the URLs of resources in 'index.html' and component stylesheets. This option is only necessary for specific deployment scenarios, such as with Angular Elements or when utilizing different CDN locations. |  |
| `externalDependencies` | array | Exclude the listed external dependencies from being bundled into the bundle. Instead, the created bundle relies on these dependencies to be available during runtime. | `[]` |
| `extractLicenses` | boolean | Extract all licenses in a separate file. | `true` |
| `fileReplacements` | array | Replace compilation source files with other compilation source files in the build. | `[]` |
| `i18nDuplicateTranslation` | string | How to handle duplicate translations for i18n. | `"warning"` |
| `i18nMissingTranslation` | string | How to handle missing translations for i18n. | `"warning"` |
| `inlineStyleLanguage` | string | The stylesheet language to use for the application's inline component styles. | `"css"` |
| `localize` | string | Translate the bundles in one or more locales. |  |
| `namedChunks` | boolean | Use file name for lazy loaded chunks. | `false` |
| `ngswConfigPath` | string | Path to ngsw-config.json. |  |
| `optimization` | string | Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, inlining of critical CSS and fonts inlining. For more information, see https://angular.dev/reference/configs/workspace-config#optimization-configuration. | `true` |
| `outputHashing` | string | Define the output filename cache-busting hashing mode. | `"none"` |
| `plugins` | array | A list of ESBuild plugins. |  |
| `poll` | number | Enable and define the file watching poll time period in milliseconds. |  |
| `polyfills` | string | Polyfills to be included in the build. |  |
| `preserveSymlinks` | boolean | Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set. |  |
| `progress` | boolean | Log progress to the console while building. | `true` |
| `resourcesOutputPath` | string | The path where style resources will be placed, relative to outputPath. |  |
| `scripts` | array | Global scripts to be included in the build. | `[]` |
| `serviceWorker` | boolean | Generates a service worker config for production builds. | `false` |
| `sourceMap` | string | Output source maps for scripts and styles. For more information, see https://angular.dev/reference/configs/workspace-config#source-map-configuration. | `false` |
| `statsJson` | boolean | Generates a 'stats.json' file which can be analyzed using tools such as 'webpack-bundle-analyzer'. | `false` |
| `stylePreprocessorOptions` | object | Options to pass to style preprocessors. |  |
| `styles` | array | Global styles to be included in the build. | `[]` |
| `subresourceIntegrity` | boolean | Enables the use of subresource integrity validation. | `false` |
| `vendorChunk` | boolean | Generate a separate bundle containing only vendor libraries. This option should only be used for development to reduce the incremental compilation time. | `false` |
| `verbose` | boolean | Adds more details to output logging. | `false` |
| `watch` | boolean | Run build when files change. | `false` |
| `webWorkerTsConfig` | string | TypeScript configuration for Web Worker modules. |  |

### `delegate-build`
Delegates the build to a different target while supporting incremental builds.

### Examples

###### Basic Usage

Delegate the build of the project to a different target.

```json
{
  "prod-build": {
    "executor": "@nx/angular:delegate-build",
    "options": {
      "buildTarget": "app:build:production",
      "outputPath": "dist/apps/app/production",
      "tsConfig": "apps/app/tsconfig.json",
      "watch": false
    }
  }
}
```

###### Watch for build changes

Delegate the build of the project to a different target.

```json
{
  "prod-build": {
    "executor": "@nx/angular:delegate-build",
    "options": {
      "buildTarget": "app:build:production",
      "outputPath": "dist/apps/app/production",
      "tsConfig": "apps/app/tsconfig.json",
      "watch": true
    }
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | Build target used for building the application after its dependencies have been built. |  |
| `outputPath` | string [**required**] | The full path for the output directory, relative to the workspace root. |  |
| `tsConfig` | string [**required**] | The full path for the TypeScript configuration file, relative to the workspace root. |  |
| `watch` | boolean | Whether to run a build when any file changes. | `false` |

### `extract-i18n`
Extracts i18n messages from source code.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | A builder target to extract i18n messages in the format of `project:target[:configuration]`. You can also pass in more than one configuration name as a comma-separated list. Example: `project:target:production,staging`. |  |
| `format` | string | Output format for the generated file. | `"xlf"` |
| `i18nDuplicateTranslation` | string | How to handle duplicate translations. _Note: this is only available in Angular 20.0.0 and above._ |  |
| `outFile` | string | Name of the file to output. |  |
| `outputPath` | string | Path where output will be placed. |  |
| `progress` | boolean | Log progress to the console. | `true` |

### `module-federation-dev-server`
Serves host [Module Federation](https://module-federation.io/) applications ([webpack](https://webpack.js.org/)-based) allowing to specify which remote applications should be served with the host.

### Examples

###### Basic Usage

The Module Federation Dev Server will serve a host application and find the remote applications associated with the host and serve them statically also.  
See an example set up of it below:

```json
{
  "serve": {
    "executor": "@nx/angular:module-federation-dev-server",
    "configurations": {
      "production": {
        "buildTarget": "host:build:production"
      },
      "development": {
        "buildTarget": "host:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "port": 4200,
      "publicHost": "http://localhost:4200"
    }
  }
}
```

###### Serve host with remotes that can be live reloaded

The Module Federation Dev Server will serve a host application and find the remote applications associated with the host and serve a set selection with live reloading enabled also.  
See an example set up of it below:

```json
{
  "serve-with-hmr-remotes": {
    "executor": "@nx/angular:module-federation-dev-server",
    "configurations": {
      "production": {
        "buildTarget": "host:build:production"
      },
      "development": {
        "buildTarget": "host:build:development"
      }
    },
    "defaultConfiguration": "development",
    "options": {
      "port": 4200,
      "publicHost": "http://localhost:4200",
      "devRemotes": [
        "remote1",
        {
          "remoteName": "remote2",
          "configuration": "development"
        }
      ]
    }
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `buildTarget` | string [**required**] | A build builder target to serve in the format of `project:target[:configuration]`. |  |
| `allowedHosts` | array | List of hosts that are allowed to access the dev server. | `[]` |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. If not set, it will take the value specified in the `buildTarget` options, or it will default to `true` if it's also not set in the `buildTarget` options. |  |
| `devRemotes` | array | List of remote applications to run in development mode (i.e. using serve target). |  |
| `disableHostCheck` | boolean | Don't verify connected clients are part of allowed hosts. | `false` |
| `headers` | object | Custom HTTP headers to be added to all responses. |  |
| `hmr` | boolean | Enable hot module replacement. | `false` |
| `host` | string | Host to listen on. | `"localhost"` |
| `isInitialHost` | boolean | Whether the host that is running this executor is the first in the project tree to do so. | `true` |
| `liveReload` | boolean | Whether to reload the page on change, using live-reload. | `true` |
| `open` | boolean | Opens the url in default browser. | `false` |
| `parallel` | number | Max number of parallel processes for building static remotes |  |
| `pathToManifestFile` | string | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic remote applications relative to the workspace root. |  |
| `poll` | number | Enable and define the file watching poll time period in milliseconds. |  |
| `port` | number | Port to listen on. | `4200` |
| `proxyConfig` | string | Proxy configuration file. For more information, see https://angular.dev/tools/cli/serve#proxying-to-a-backend-server. |  |
| `publicHost` | string | The URL that the browser client (or live-reload client, if enabled) should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies. |  |
| `servePath` | string | The pathname where the app will be served. |  |
| `skipRemotes` | array | List of remote applications to not automatically serve, either statically or in development mode. This will not remove the remotes from the `module-federation.config` file, and therefore the application may still try to fetch these remotes.
This option is useful if you have other means for serving the `remote` application(s).
**NOTE:** Remotes that are not in the workspace will be skipped automatically. |  |
| `ssl` | boolean | Serve using HTTPS. | `false` |
| `sslCert` | string | SSL certificate to use for serving HTTPS. |  |
| `sslKey` | string | SSL key to use for serving HTTPS. |  |
| `static` | boolean | Whether to use a static file server instead of the webpack-dev-server. This should be used for remote applications that are also host applications. |  |
| `staticRemotesPort` | number | The port at which to serve the file-server for the static remotes. |  |
| `verbose` | boolean | Adds more details to output logging. |  |
| `watch` | boolean | Rebuild on change. | `true` |

### `module-federation-dev-ssr`
The module-federation-ssr-dev-server executor is reserved exclusively for use with host SSR Module Federation applications. It allows the user to specify which remote applications should be served with the host.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `browserTarget` | string [**required**] | Browser target to build. |  |
| `serverTarget` | string [**required**] | Server target to build. |  |
| `devRemotes` | array | List of remote applications to run in development mode (i.e. using serve target). |  |
| `host` | string | Host to listen on. | `"localhost"` |
| `inspect` | boolean | Launch the development server in inspector mode and listen on address and port '127.0.0.1:9229'. | `false` |
| `isInitialHost` | boolean | Whether the host that is running this executor is the first in the project tree to do so. | `true` |
| `open` | boolean | Opens the url in default browser. | `false` |
| `parallel` | number | Max number of parallel processes for building static remotes |  |
| `pathToManifestFile` | string | Path to a Module Federation manifest file (e.g. `my/path/to/module-federation.manifest.json`) containing the dynamic remote applications relative to the workspace root. |  |
| `port` | number | Port to start the development server at. Default is 4200. Pass 0 to get a dynamically assigned port. | `4200` |
| `progress` | boolean | Log progress to the console while building. |  |
| `proxyConfig` | string | Proxy configuration file. |  |
| `publicHost` | string | The URL that the browser client should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies. |  |
| `skipRemotes` | array | List of remote applications to not automatically serve, either statically or in development mode. |  |
| `ssl` | boolean | Serve using HTTPS. | `false` |
| `sslCert` | string | SSL certificate to use for serving HTTPS. |  |
| `sslKey` | string | SSL key to use for serving HTTPS. |  |
| `staticRemotesPort` | number | The port at which to serve the file-server for the static remotes. |  |
| `verbose` | boolean | Adds more details to output logging. | `false` |

### `ng-packagr-lite`
Builds an Angular library with support for incremental builds.

This executor is meant to be used with buildable libraries in an incremental build scenario. It is similar to the `@nx/angular:package` executor but it only produces ESM2022 bundles.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `poll` | number | Enable and define the file watching poll time period in milliseconds. |  |
| `project` | string | The file path for the ng-packagr configuration file, relative to the workspace root. |  |
| `tsConfig` | string | The full path for the TypeScript configuration file, relative to the workspace root. |  |
| `watch` | boolean | Whether to run a build when any file changes. | `false` |

### `package`
Builds and packages an Angular library producing an output following the Angular Package Format (APF) to be distributed as an NPM package.

This executor is a drop-in replacement for the `@angular-devkit/build-angular:ng-packagr` and `@angular/build:ng-packagr` builders, with additional support for incremental builds.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `poll` | number | Enable and define the file watching poll time period in milliseconds. |  |
| `project` | string | The file path for the ng-packagr configuration file, relative to the workspace root. |  |
| `tsConfig` | string | The full path for the TypeScript configuration file, relative to the workspace root. |  |
| `watch` | boolean | Whether to run a build when any file changes. | `false` |

### `unit-test`
Run application unit tests. _Note: this is only supported in Angular versions >= 21.0.0_.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `browsers` | array | Specifies the browsers to use for test execution. When not specified, tests are run in a Node.js environment using jsdom. For both Vitest and Karma, browser names ending with 'Headless' (e.g., 'ChromeHeadless') will enable headless mode. |  |
| `browserViewport` | string | Specifies the browser viewport dimensions for browser-based tests in the format `widthxheight`. |  |
| `buildTarget` | string | Specifies the build target to use for the unit test build in the format `project:target[:configuration]`. This defaults to the `build` target of the current project with the `development` configuration. You can also pass a comma-separated list of configurations. Example: `project:target:production,staging`. |  |
| `coverage` | boolean | Enables coverage reporting for tests. | `false` |
| `coverageExclude` | array | Specifies glob patterns of files to exclude from the coverage report. |  |
| `coverageInclude` | array | Specifies glob patterns of files to include in the coverage report. |  |
| `coverageReporters` | array | Specifies the reporters to use for coverage results. Each reporter can be a string representing its name, or a tuple containing the name and an options object. Built-in reporters include 'html', 'lcov', 'lcovonly', 'text', 'text-summary', 'cobertura', 'json', and 'json-summary'. |  |
| `coverageThresholds` | object | Specifies minimum coverage thresholds that must be met. If thresholds are not met, the builder will exit with an error. |  |
| `coverageWatermarks` | object | Specifies coverage watermarks for the HTML reporter. These determine the color coding for high, medium, and low coverage. |  |
| `debug` | boolean | Enables debugging mode for tests, allowing the use of the Node Inspector. | `false` |
| `dumpVirtualFiles` | boolean | Dumps build output files to the `.angular/cache` directory for debugging purposes. | `false` |
| `exclude` | array | Specifies glob patterns of files to exclude from testing, relative to the project root. |  |
| `filter` | string | Specifies a regular expression pattern to match against test suite and test names. Only tests with a name matching the pattern will be executed. For example, `^App` will run only tests in suites beginning with 'App'. |  |
| `headless` | boolean | Forces all configured browsers to run in headless mode. When using the Vitest runner, this option is ignored if no browsers are configured. The Karma runner does not support this option. _Note: this is only supported in Angular versions >= 21.2.0_. |  |
| `include` | array | Specifies glob patterns of files to include for testing, relative to the project root. This option also has special handling for directory paths (includes all test files within) and file paths (includes the corresponding test file if one exists). | `["**/*.spec.ts","**/*.test.ts"]` |
| `indexHtmlTransformer` | string | Path to a file exposing a default function to transform the `index.html` file. |  |
| `listTests` | boolean | Lists all discovered test files and exits the process without building or executing the tests. | `false` |
| `outputFile` | string | Specifies a file path for the test report, applying only to the first reporter. To configure output files for multiple reporters, use the tuple format `['reporter-name', { outputFile: '...' }]` within the `reporters` option. When not provided, output is written to the console. |  |
| `plugins` | array | A list of ESBuild plugins. |  |
| `progress` | boolean | Shows build progress information in the console. Defaults to the `progress` setting of the specified `buildTarget`. |  |
| `providersFile` | string | Specifies the path to a TypeScript file that provides an array of Angular providers for the test environment. The file must contain a default export of the provider array. |  |
| `reporters` | array | Specifies the reporters to use during test execution. Each reporter can be a string representing its name, or a tuple containing the name and an options object. Built-in reporters include 'default', 'verbose', 'dots', 'json', 'junit', 'tap', 'tap-flat', and 'html'. You can also provide a path to a custom reporter. |  |
| `runner` | string | Specifies the test runner to use for test execution. | `"vitest"` |
| `runnerConfig` | string | boolean | Specifies the configuration file for the selected test runner. If a string is provided, it will be used as the path to the configuration file. If `true`, the builder will search for a default configuration file (e.g., `vitest.config.ts` or `karma.conf.js`). If `false`, no external configuration file will be used.\nFor Vitest, this enables advanced options and the use of custom plugins. Please note that while the file is loaded, the Angular team does not provide direct support for its specific contents or any third-party plugins used within it. | `false` |
| `setupFiles` | array | A list of paths to global setup files that are executed before the test files. The application's polyfills and the Angular TestBed are always initialized before these files. |  |
| `tsConfig` | string | The path to the TypeScript configuration file, relative to the workspace root. Defaults to `tsconfig.spec.json` in the project root if it exists. If not specified and the default does not exist, the `tsConfig` from the specified `buildTarget` will be used. |  |
| `ui` | boolean | Enables the Vitest UI for interactive test execution. This option is only available for the Vitest runner. |  |
| `watch` | boolean | Enables watch mode, which re-runs tests when source files change. Defaults to `true` in TTY environments and `false` otherwise. |  |
