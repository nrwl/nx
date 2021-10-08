# @nrwl/web:build

Build a application

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### index (_**required**_)

Type: `string`

HTML File which will be contain the application

### main (_**required**_)

Type: `string`

The name of the main entry-point file.

### tsConfig (_**required**_)

Type: `string`

The name of the Typescript configuration file.

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

### commonChunk

Default: `true`

Type: `boolean`

Use a separate bundle containing code used across multiple bundles.

### crossOrigin

Type: `string`

The crossorigin attribute to use for generated javascript script tags. One of 'none' | 'anonymous' | 'use-credentials'

### deleteOutputPath

Default: `true`

Type: `boolean`

Delete the output path before building.

### deployUrl

Type: `string`

URL where the application will be deployed.

### es2015Polyfills

Type: `string`

Conditional polyfills loaded in browsers which do not support ES2015.

### extractCss

Default: `false`

Type: `boolean`

Extract css into a .css file

### extractLicenses

Default: `false`

Type: `boolean`

Extract all licenses in a separate file, in the case of production builds only.

### fileReplacements

Type: `object[]`

Replace files with other files in the build.

#### replace

Type: `string`

The file to be replaced.

#### with

Type: `string`

The file to replace with.

### generateIndexHtml

Default: `true`

Type: `boolean`

Generates `index.html` file to the output path. This can be turned off if using a webpack plugin to generate HTML such as `html-webpack-plugin`

### maxWorkers

Type: `number`

Number of workers to use for type checking. (defaults to # of CPUS - 2)

### memoryLimit

Type: `number`

Memory limit for type checking service process in MB. (defaults to 2048)

### namedChunks

Default: `true`

Type: `boolean`

Names the produced bundles according to their entry file

### optimization

Type: `boolean`

Enables optimization of the build output.

### outputHashing

Default: `none`

Type: `string`

Possible values: `none`, `all`, `media`, `bundles`

Define the output filename cache-busting hashing mode.

### outputPath

Type: `string`

The output path of the generated files.

### polyfills

Type: `string`

Polyfills to load before application

### progress

Default: `false`

Type: `boolean`

Log progress to the console while building.

### runtimeChunk

Default: `true`

Type: `boolean`

Use a separate bundle containing the runtime.

### scripts

Type: `array`

External Scripts which will be included before the main application entry

### ~~showCircularDependencies~~

Default: `false`

Type: `boolean`

**Deprecated:** The recommended method to detect circular dependencies in project code is to use a either a lint rule or other external tooling.

Show circular dependency warnings on builds.

### sourceMap

Default: `true`

Type: `boolean`

Output sourcemaps.

### statsJson

Default: `false`

Type: `boolean`

Generates a 'stats.json' file which can be analyzed using tools such as: 'webpack-bundle-analyzer' or <https://webpack.github.io/analyse>.

### styles

Type: `array`

External Styles which will be included with the application

### subresourceIntegrity

Default: `false`

Type: `boolean`

Enables the use of subresource integrity validation.

### vendorChunk

Default: `true`

Type: `boolean`

Use a separate bundle containing only vendor libraries.

### verbose

Default: `false`

Type: `boolean`

Emits verbose output

### watch

Default: `false`

Type: `boolean`

Enable re-building when files change.

### webpackConfig

Type: `string`

Path to a function which takes a webpack config, some context and returns the resulting webpack config
