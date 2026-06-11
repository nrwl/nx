
  The @nx/webpack plugin provides various executors to help you create and configure webpack projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `dev-server`
Serve an application using webpack.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `allowedHosts` | string | This option allows you to whitelist services that are allowed to access the dev server. |  |
| `baseHref` | string | Base url for the application being built. |  |
| `buildTarget` | string | Target which builds the application. |  |
| `hmr` | boolean | Enable hot module replacement. | `false` |
| `host` | string | Host to listen on. | `"localhost"` |
| `liveReload` | boolean | Whether to reload the page on change, using live-reload. | `true` |
| `memoryLimit` | number | Memory limit for type checking service process in `MB`. |  |
| `open` | boolean | Open the application in the browser. | `false` |
| `port` | number | Port to listen on. | `4200` |
| `publicHost` | string | Public URL where the application will be served. |  |
| `ssl` | boolean | Serve using `HTTPS`. | `false` |
| `sslCert` | string | SSL certificate to use for serving `HTTPS`. |  |
| `sslKey` | string | SSL key to use for serving `HTTPS`. |  |
| `watch` | boolean | Watches for changes and rebuilds application. | `true` |

### `ssr-dev-server`
Serve a SSR application using webpack.


#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `browserTarget` | string [**required**] | Target which builds the browser application. |  |
| `serverTarget` | string [**required**] | Target which builds the server application. |  |
| `browserTargetOptions` | object | Additional options to pass into the browser build target. | `{}` |
| `port` | number | The port to be set on `process.env.PORT` for use in the server. | `4200` |
| `serverTargetOptions` | object | Additional options to pass into the server build target. | `{}` |

### `webpack`
Build a project using webpack.

`project.json`:

```json5
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js"
      }
    },
    //...
  }
}
```

```bash
nx build my-app
```

### Examples

###### Using `babelUpwardRootMode`

Copying from the [Babel documentation](https://babeljs.io/docs/config-files#root-babelconfigjson-file):

> [...] if you are running your Babel compilation process from within a subpackage, you need to tell Babel where to look for the config. There are a few ways to do that, but the recommended way is the "rootMode" option with "upward", which will make Babel search from the working directory upward looking for your babel.config.json file, and will use its location as the "root" value.

Setting `babelUpwardRootMode` to `true` in your `project.json` will set `rootMode` option to `upward` in the Babel config. You may want the `upward` mode in a monorepo when projects must apply their individual `.babelrc` file. We recommend that you don't set it at all, so it will use the default to `false` as the `upward` mode brings additional complexity to the build process.

```json5
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        "babelUpwardRootMode": true
      }
    },
    //...
  }
}
```

When `babelUpwardRootMode` is `true`, Babel will look for a root `babel.config.json` at the root of the workspace, which should look something like this to include all packages:

```json
{ "babelrcRoots": ["*"] }
```

Then for each package, you must have a `.babelrc` file that will be applied to that package. For example:

```json
{
  "presets": ["@babel/preset-env", "@babel/preset-typescript"]
}
```

All packages will use its own `.babelrc` file, thus you must ensure the right presets and plugins are set in each config file. This behavior can lead to build discrepancies between packages, so we recommend that you don't set `babelUpwardRootMode` at all.

```text
├── apps
│   └── demo
│       └── .babelrc
├── libs
│   ├── a
│   │   └── .babelrc
│   └── b
│       └── .babelrc
└── babel.config.json
```

In workspace above, if `demo` imports `a` and `b`, it will apply the config `libs/a/.babelrc` and `libs/b/.babelrc` to the respective packages and not apply its own `apps/demo/.babelrc` to `a` and `b`. Anything in `babel.config.json` will apply to all packages.

###### Specify a custom Babel config file

If you have a custom Babel config file (i.e. not `.babelrc`), you can use the `configFile` option as follows:

```json5
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        "babelConfig": "apps/my-app/.babelrc.custom.json",
      }
    },
    // ...
  }
}
```

If you do not set the path to the `.babelrc` file, Nx will look for a `.babelrc` file in the root of your application.

Note that this option does not work if `babelUpwardRootMode` is set to `true`.

###### Run webpack with `isolatedConfig`

Setting `isolatedConfig` to `true` in your `project.json` file means that Nx will not apply the Nx webpack plugins automatically. In that case, the Nx plugins need to be applied in the project's `webpack.config.js` file (e.g. `withNx`, `withReact`, etc.). So don't forget to also specify the path to your webpack config file (using the `webpackConfig` option).

Read more on how to configure Webpack in our [Nx Webpack config guide](/recipes/webpack/webpack-config-setup) an in our [Webpack Plugins guide](/recipes/webpack/webpack-plugins).

Note that this is the new default setup for webpack in the latest version of Nx.

Set `isolatedConfig` to `true` in your `project.json` file in the `build` target options like this:

```json
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        "isolatedConfig": true
      }
    },
  }
}
```

###### Configuring type checking

You can configure type checking behavior using the `typeCheckOptions` option. By default, type checking runs asynchronously (non-blocking).

```json5
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        // Run type checking asynchronously (non-blocking)
        "typeCheckOptions": { "async": true }
      }
    },
    //...
  }
}
```

To disable type checking entirely:

```json5
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        "typeCheckOptions": false
      }
    },
    //...
  }
}
```

###### Adding runtime dependencies to generated package.json

When using `generatePackageJson`, you can add additional runtime dependencies that should be included in the generated `package.json` file. This is useful for Docker installs where you need dependencies that aren't detected automatically:

```json5
//...
"my-app": {
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        "generatePackageJson": true,
        "runtimeDependencies": ["pg", "redis"]
      }
    },
    //...
  }
}
```
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `additionalEntryPoints` | array |  |  |
| `assets` | array | List of static application assets. |  |
| `babelConfig` | string | Path to the babel configuration file of your project. If not provided, Nx will default to the .babelrc file at the root of your project. See https://babeljs.io/docs/en/config-files |  |
| `babelUpwardRootMode` | boolean | Whether to set rootmode to upward. See https://babeljs.io/docs/en/options#rootmode |  |
| `baseHref` | string | Base url for the application being built. |  |
| `buildLibsFromSource` | boolean | Read buildable libraries from source instead of building them separately. If set to `false`, the `tsConfig` option must also be set to remap paths. | `true` |
| `cache` | string | Configure webpack caching behavior. When not specified, defaults to `{ type: 'memory' }` for Node targets in watch mode, and `undefined` otherwise. |  |
| `commonChunk` | boolean | Use a separate bundle containing code used across multiple bundles. |  |
| `compiler` | string | The compiler to use. |  |
| `crossOrigin` | string | The `crossorigin` attribute to use for generated javascript script tags.  One of 'none' | 'anonymous' | 'use-credentials'. |  |
| `deployUrl` | string | URL where the application will be deployed. |  |
| `externalDependencies` | string | Dependencies to keep external to the bundle. (`all` (default), `none`, or an array of module names) |  |
| `extractCss` | boolean | Extract CSS into a `.css` file. |  |
| `extractLicenses` | boolean | Extract all licenses in a separate file, in the case of production builds only. |  |
| `fileReplacements` | array | Replace files with other files in the build. |  |
| `generateIndexHtml` | boolean | Generates `index.html` file to the output path. This can be turned off if using a webpack plugin to generate HTML such as `html-webpack-plugin`. |  |
| `generatePackageJson` | boolean | Generates a `package.json` and pruned lock file with the project's `node_module` dependencies populated for installing in a container. If a `package.json` exists in the project's directory, it will be reused with dependencies populated. |  |
| `index` | string | HTML File which will be contain the application. |  |
| `main` | string | The name of the main entry-point file. |  |
| `memoryLimit` | number | Memory limit for type checking service process in `MB`. |  |
| `namedChunks` | boolean | Names the produced bundles according to their entry file. |  |
| `optimization` | string | Enables optimization of the build output. |  |
| `outputFileName` | string | Name of the main output file. | `"main.js"` |
| `outputHashing` | string | Define the output filename cache-busting hashing mode. |  |
| `outputPath` | string | The output path of the generated files. |  |
| `poll` | number | Enable and define the file watching poll time period. |  |
| `polyfills` | string | Polyfills to load before application |  |
| `postcssConfig` | string | Set a path to PostCSS config that applies to the app and all libs. Defaults to `undefined`, which auto-detects postcss.config.js files in each `app`/`lib` directory. |  |
| `progress` | boolean | Log progress to the console while building. |  |
| `publicPath` | string | Set a public path for assets resources with absolute paths. |  |
| `rebaseRootRelative` | boolean | Whether to rebase absolute path for assets in postcss cli resources. |  |
| `runtimeChunk` | boolean | Use a separate bundle containing the runtime. |  |
| `runtimeDependencies` | array | Add runtime dependencies to the generated `package.json` file. Useful for Docker install. |  |
| `scripts` | array | External Scripts which will be included before the main application entry. |  |
| `skipOverrides` | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `skipPackageManager` | boolean | Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |  |
| `skipTypeChecking` | boolean | Skip the type checking. Default is `false`. |  |
| `sourceMap` | string | Output sourcemaps. Use 'hidden' for use with error reporting tools without generating sourcemap comment. |  |
| `standardWebpackConfigFunction` | boolean | Set to true if the webpack config exports a standard webpack function, not an Nx-specific one. See: https://webpack.js.org/configuration/configuration-types/#exporting-a-function | `false` |
| `statsJson` | boolean | Generates a 'stats.json' file which can be analyzed using tools such as: 'webpack-bundle-analyzer' or `<https://webpack.github.io/analyse>`. |  |
| `stylePreprocessorOptions` | object | Options to pass to style preprocessors. |  |
| `styles` | array | External Styles which will be included with the application |  |
| `subresourceIntegrity` | boolean | Enables the use of subresource integrity validation. |  |
| `target` | string | Target platform for the build, same as the Webpack target option. |  |
| `transformers` | array | List of TypeScript Compiler Transfomers Plugins. |  |
| `tsConfig` | string | The name of the Typescript configuration file. |  |
| `typeCheckOptions` | string | Configure type checking during the build. Set to `true` to enable with defaults (async: true). Set to `false` to disable type checking entirely. Use `{ async: true }` to run type checking in a separate process without blocking the build. Default is `{ async: true }`. |  |
| `vendorChunk` | boolean | Use a separate bundle containing only vendor libraries. |  |
| `verbose` | boolean | Emits verbose output |  |
| `watch` | boolean | Enable re-building when files change. |  |
| `webpackConfig` | string | Path to a function which takes a webpack config, some context and returns the resulting webpack config. See https://nx.dev/guides/customize-webpack |  |
