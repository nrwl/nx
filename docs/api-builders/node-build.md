# node-build

Build a Node application

## Properties

### externalDependencies

Default: `all`

Type: `string`

Dependencies to keep external to the bundle. ("all" (default), "none", or an array of module names)

### extractLicenses

Default: `false`

Type: `boolean`

Extract all licenses in a separate file, in the case of production builds only.

### main

Type: `string`

The name of the main entry-point file.

### maxWorkers

Type: `number`

Number of workers to use for type checking. (defaults to # of CPUS - 2)

### optimization

Default: `false`

Type: `boolean`

Defines the optimization level of the build.

### poll

Type: `number`

Frequency of file watcher in ms.

### progress

Default: `false`

Type: `boolean`

Log progress to the console while building.

### showCircularDependencies

Default: `true`

Type: `boolean`

Show circular dependency warnings on builds.

### sourceMap

Default: `true`

Type: `boolean`

Produce source maps.

### statsJson

Default: `false`

Type: `boolean`

Generates a 'stats.json' file which can be analyzed using tools such as: #webpack-bundle-analyzer' or https: //webpack.github.io/analyse.

### tsConfig

Type: `string`

The name of the Typescript configuration file.

### watch

Default: `false`

Type: `boolean`

Run build when files change.

### webpackConfig

Type: `string`

Path to a function which takes a webpack config, context and returns the resulting webpack config
