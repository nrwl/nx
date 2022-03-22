---
title: "@nrwl/angular:webpack-browser executor"
description: "The webpack-browser executor is very similar to the standard browser builder provided by the Angular Devkit. It allows you to build your Angular application to a build artifact that can be hosted online. There are some key differences:   
- Supports Custom Webpack Configurations  
- Supports Incremental Building"
---

# @nrwl/angular:webpack-browser

The webpack-browser executor is very similar to the standard browser builder provided by the Angular Devkit. It allows you to build your Angular application to a build artifact that can be hosted online. There are some key differences:

- Supports Custom Webpack Configurations
- Supports Incremental Building

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Examples

##### Using a custom webpack configuration

The executor supports providing a path to a custom webpack configuration. This allows you to customize how your Angular application is built. It currently supports the following types of webpack configurations:

- `object`
- `Function`
- `Promise<object|Function>`

The executor will merge the provided configuration with the webpack configuration that Angular Devkit uses. The merge order is:

- Angular Devkit Configuration
- Provided Configuration

To use a custom webpack configuration when building your Angular application, change the `build` target in your `project.json` to match the following:

```ts
"build": {
    "executor": "@nrwl/angular:webpack-browser",
    "options": {
        ...
        "customWebpackConfig": {
          "path": "apps/appName/webpack.config.js"
        }
    }
}
```

##### Incrementally Building your Application

The executor supports incrementally building your Angular application by building the workspace libraries it depends on _(that have been marked as buildable)_ and then building your application using the built source of the libraries.

This can improve build time as the building of the workspace libraries can be cached, meaning they only have to be rebuilt if they have changed.

> Note: There may be some additional overhead in the linking of the built libraries' sources which may reduce the overall improvement in build time. Therefore this approach only benefits large applications and would likely have a negative impact on small and medium applications.  
> You can read more about when to use incremental builds [here](/ci/incremental-builds#when-should-i-use-incremental-builds).

To allow your Angular application to take advantage of incremental building, change the `build` target in your `project.json` to match the following:

```ts
"build": {
    "executor": "@nrwl/angular:webpack-browser",
    "options": {
        ...
        "buildLibsFromSource": false
    }
}
```

## Options

### index (_**required**_)

Type: `string`

Configures the generation of the application's HTML index.

### main (_**required**_)

Type: `string`

The full path for the main entry point to the app, relative to the current workspace.

### outputPath (_**required**_)

Type: `string`

            The full path for the new output directory, relative to the current workspace.

By default, writes output to a folder named dist/ in the current project.

### tsConfig (_**required**_)

Type: `string`

The full path for the TypeScript configuration file, relative to the current workspace.

### allowedCommonJsDependencies

Type: `array`

A list of CommonJS packages that are allowed to be used without a build time warning.

### aot

Default: `true`

Type: `boolean`

Build using Ahead of Time compilation.

### assets

Type: `array`

List of static application assets.

### baseHref

Type: `string`

Base url for the application being built.

### budgets

Type: `array`

Budget thresholds to ensure parts of your application stay within boundaries which you set.

### buildLibsFromSource

Default: `true`

Type: `boolean`

Read buildable libraries from source instead of building them separately.

### buildOptimizer

Default: `true`

Type: `boolean`

Enables '@angular-devkit/build-optimizer' optimizations when using the 'aot' option.

### commonChunk

Default: `true`

Type: `boolean`

Generate a seperate bundle containing code used across multiple bundles.

### crossOrigin

Default: `none`

Type: `string`

Possible values: `none`, `anonymous`, `use-credentials`

Define the crossorigin attribute setting of elements that provide CORS support.

### deleteOutputPath

Default: `true`

Type: `boolean`

Delete the output path before building.

### ~~deployUrl~~

Type: `string`

**Deprecated:** Use "baseHref" option, "APP_BASE_HREF" DI token or a combination of both instead. For more information, see https://angular.io/guide/deployment#the-deploy-url.

URL where files will be deployed.

### extractLicenses

Default: `true`

Type: `boolean`

Extract all licenses in a separate file.

### fileReplacements

Type: `array`

Replace compilation source files with other compilation source files in the build.

### i18nDuplicateTranslation

Default: `warning`

Type: `string`

Possible values: `warning`, `error`, `ignore`

How to handle duplicate translations for i18n.

### i18nMissingTranslation

Default: `warning`

Type: `string`

Possible values: `warning`, `error`, `ignore`

How to handle missing translations for i18n.

### inlineStyleLanguage

Default: `css`

Type: `string`

Possible values: `css`, `less`, `sass`, `scss`

The stylesheet language to use for the application's inline component styles.

### localize

Type: `boolean | boolean[] `

Translate the bundles in one or more locales.

### namedChunks

Default: `false`

Type: `boolean`

Use file name for lazy loaded chunks.

### ngswConfigPath

Type: `string`

Path to ngsw-config.json.

### optimization

Default: `true`

Type: `boolean`

Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, inlining of critical CSS and fonts inlining. For more information, see https://angular.io/guide/workspace-config#optimization-configuration.

### outputHashing

Default: `none`

Type: `string`

Possible values: `none`, `all`, `media`, `bundles`

Define the output filename cache-busting hashing mode.

### poll

Type: `number`

Enable and define the file watching poll time period in milliseconds.

### polyfills

Type: `string`

The full path for the polyfills file, relative to the current workspace.

### preserveSymlinks

Type: `boolean`

Do not use the real path when resolving modules. If unset then will default to `true` if NodeJS option --preserve-symlinks is set.

### progress

Default: `true`

Type: `boolean`

Log progress to the console while building.

### resourcesOutputPath

Type: `string`

The path where style resources will be placed, relative to outputPath.

### scripts

Type: `array`

Global scripts to be included in the build.

### serviceWorker

Default: `false`

Type: `boolean`

Generates a service worker config for production builds.

### ~~showCircularDependencies~~

Default: `false`

Type: `boolean`

**Deprecated:** The recommended method to detect circular dependencies in project code is to use either a lint rule or other external tooling.

Show circular dependency warnings on builds.

### sourceMap

Default: `false`

Type: `boolean`

Output source maps for scripts and styles. For more information, see https://angular.io/guide/workspace-config#source-map-configuration.

### statsJson

Default: `false`

Type: `boolean`

Generates a 'stats.json' file which can be analyzed using tools such as 'webpack-bundle-analyzer'.

### styles

Type: `array`

Global styles to be included in the build.

### subresourceIntegrity

Default: `false`

Type: `boolean`

Enables the use of subresource integrity validation.

### vendorChunk

Default: `false`

Type: `boolean`

Generate a seperate bundle containing only vendor libraries. This option should only used for development.

### verbose

Default: `false`

Type: `boolean`

Adds more details to output logging.

### watch

Default: `false`

Type: `boolean`

Run build when files change.

### webWorkerTsConfig

Type: `string`

TypeScript configuration for Web Worker modules.
