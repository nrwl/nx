# @nrwl/node:package

Package a Node library

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### main (_**required**_)

Type: `string`

The name of the main entry-point file.

### tsConfig (_**required**_)

Type: `string`

The name of the Typescript configuration file.

### assets

Type: `array`

List of static library assets.

### buildableProjectDepsInPackageJsonType

Default: `dependencies`

Type: `string`

Possible values: `dependencies`, `peerDependencies`

When updateBuildableProjectDepsInPackageJson is true, this adds dependencies to either `peerDependencies` or `dependencies`

### cli

Type: `boolean`

Adds a CLI wrapper to main entry-point file.

### deleteOutputPath

Default: `true`

Type: `boolean`

Delete the output path before building.

### experimentalSwc

Default: `false`

Type: `boolean`

Use swc as TypeScript loader instead of tsc and babel

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

### srcRootForCompilationRoot

Type: `string`

Sets the rootDir for TypeScript compilation. When not defined, it uses the project's root property

### tsPlugins

Type: `array`

List of TypeScript Compiler Plugins.

### updateBuildableProjectDepsInPackageJson

Default: `true`

Type: `boolean`

Update buildable project dependencies in package.json

### watch

Default: `false`

Type: `boolean`

Enable re-building when files change.
