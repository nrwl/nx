# bundle

Bundle a library

Builder properties can be configured in angular.json when defining the builder, or when invoking it.

## Properties

### babelConfig

Type: `string`

Path to a function which takes a babel config and returns an updated babel config

### entryFile

Type: `string`

The path to the entry file, relative to project.

### external

Type: `array`

A list of external modules that will not be bundled (react, react-dom, etc.).

### outputPath

Type: `string`

The output path of the generated files.

### project

Type: `string`

The path to package.json file.

### rollupConfig

Type: `string`

Path to a function which takes a rollup config and returns an updated rollup config

### tsConfig

Type: `string`

The path to tsconfig file.

### umdName

Type: `string`

The name of your module in UMD format. Defaulted to your project name.

### watch

Default: `false`

Type: `boolean`

Enable re-building when files change.
