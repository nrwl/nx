# web-build

Build a web application

## Properties

### baseHref

Default: `/`

Type: `string`

Base url for the application being built.

### commonChunk

Default: `true`

Type: `boolean`

Use a separate bundle containing code used across multiple bundles.

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

Define the output filename cache-busting hashing mode.

### polyfills

Type: `string`

Polyfills to load before application

### progress

Default: `false`

Type: `boolean`

Log progress to the console while building.

### scripts

Type: `array`

External Scripts which will be included before the main application entry

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

Generates a 'stats.json' file which can be analyzed using tools such as: #webpack-bundle-analyzer' or https://webpack.github.io/analyse.

### styles

Type: `array`

External Styles which will be included with the application

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

### watch

Default: `false`

Type: `boolean`

Enable re-building when files change.

### webpackConfig

Type: `string`

Path to a function which takes a webpack config, some context and returns the resulting webpack config
