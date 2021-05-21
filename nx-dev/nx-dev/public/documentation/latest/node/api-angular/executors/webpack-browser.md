# webpack-browser

Angular browser builder that supports incremental builds

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/cli-overview#running-tasks.

## Properties

### allowedCommonJsDependencies

Type: `array`

A list of CommonJS packages that are allowed to be used without a build time warning.

### aot

Default: `false`

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

### buildOptimizer

Default: `false`

Type: `boolean`

Enables '@angular-devkit/build-optimizer' optimizations when using the 'aot' option.

### commonChunk

Default: `true`

Type: `boolean`

Use a separate bundle containing code used across multiple bundles.

### crossOrigin

Default: `none`

Type: `string`

Possible values: `none`, `anonymous`, `use-credentials`

Define the crossorigin attribute setting of elements that provide CORS support.

### deleteOutputPath

Default: `true`

Type: `boolean`

Delete the output path before building.

### deployUrl

Type: `string`

URL where files will be deployed.

### experimentalRollupPass

Default: `false`

Type: `boolean`

Concatenate modules with Rollup before bundling them with Webpack.

### extractCss

Default: `false`

Type: `boolean`

Extract css from global styles into css files instead of js ones.

### extractLicenses

Default: `false`

Type: `boolean`

Extract all licenses in a separate file.

### fileReplacements

Type: `array`

Replace compilation source files with other compilation source files in the build.

### forkTypeChecker

Default: `true`

Type: `boolean`

Run the TypeScript type checker in a forked process.

### i18nFile

Type: `string`

Localization file to use for i18n.

### i18nFormat

Type: `string`

Format of the localization file specified with --i18n-file.

### i18nLocale

Type: `string`

Locale to use for i18n.

### i18nMissingTranslation

Default: `warning`

Type: `string`

Possible values: `warning`, `error`, `ignore`

How to handle missing translations for i18n.

### index

Type: `string`

Configures the generation of the application's HTML index.

### lazyModules

Type: `array`

List of additional NgModule files that will be lazy loaded. Lazy router modules will be discovered automatically.

### localize

Type: `boolean | boolean[] `

### main

Type: `string`

The full path for the main entry point to the app, relative to the current workspace.

### namedChunks

Default: `true`

Type: `boolean`

Use file name for lazy loaded chunks.

### ngswConfigPath

Type: `string`

Path to ngsw-config.json.

### optimization

Default: `false`

Type: `boolean`

Enables optimization of the build output.

### outputHashing

Default: `none`

Type: `string`

Possible values: `none`, `all`, `media`, `bundles`

Define the output filename cache-busting hashing mode.

### outputPath

Type: `string`

            The full path for the new output directory, relative to the current workspace.

By default, writes output to a folder named dist/ in the current project.

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

### showCircularDependencies

Default: `true`

Type: `boolean`

Show circular dependency warnings on builds.

### sourceMap

Default: `true`

Type: `boolean`

Output sourcemaps.

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

### tsConfig

Type: `string`

The full path for the TypeScript configuration file, relative to the current workspace.

### vendorChunk

Default: `true`

Type: `boolean`

Use a separate bundle containing only vendor libraries.

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
