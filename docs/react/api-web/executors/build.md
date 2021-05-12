# build

Build a application

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/nx-cli#running-tasks.

## Properties

### baseHref

Default: `/`

Type: `string`

Base url for the application being built.

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

### index

Type: `string`

HTML File which will be contain the application

### main

Type: `string`

The name of the main entry-point file.

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

### subresourceIntegrity

Default: `false`

Type: `boolean`

Enables the use of subresource integrity validation.

### tsConfig

Type: `string`

The name of the Typescript configuration file.

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
