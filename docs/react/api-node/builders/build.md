# build

Build a Node application

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/react/guides/cli.

## Properties

### assets

Type: `array`

List of static application assets.

### buildLibsFromSource

Default: `false`

Type: `boolean`

Read buildable libraries from source instead of building them separately.

### externalDependencies

Default: `all`

Type: `string | string[]`

Dependencies to keep external to the bundle. ("all" (default), "none", or an array of module names)

### extractLicenses

Default: `false`

Type: `boolean`

Extract all licenses in a separate file, in the case of production builds only.

### fileReplacements

Type: `object[]`

Replace files with other files in the build.

#### replace

Type: `string`

undefined

#### with

Type: `string`

undefined

### main

Type: `string`

The name of the main entry-point file.

### maxWorkers

Type: `number`

Number of workers to use for type checking. (defaults to # of CPUS - 2)

### memoryLimit

Type: `number`

Memory limit for type checking service process in MB. (defaults to 2048)

### optimization

Default: `false`

Type: `boolean`

Defines the optimization level of the build.

### outputPath

Type: `string`

The output path of the generated files.

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

### verbose

Default: `false`

Type: `boolean`

Emits verbose output

### watch

Default: `false`

Type: `boolean`

Run build when files change.

### webpackConfig

Type: `string`

Path to a function which takes a webpack config, context and returns the resulting webpack config
