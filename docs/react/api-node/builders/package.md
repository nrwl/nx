# package

Package a Node library

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/react/guides/cli.

## Properties

### assets

Type: `array`

List of static library assets.

### main

Type: `string`

The name of the main entry-point file.

### outputPath

Type: `string`

The output path of the generated files.

### packageJson

Type: `string`

The name of the package.json file

### sourceMap

Default: `true`

Type: `boolean`

Output sourcemaps.

### tsConfig

Type: `string`

The name of the Typescript configuration file.

### watch

Default: `false`

Type: `boolean`

Enable re-building when files change.
