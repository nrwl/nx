# package

Package a library

Properties can be configured in angular.json when defining the executor, or when invoking it.

## Properties

### assets

Type: `array`

List of static assets.

### babelConfig

Type: `string`

(deprecated) Path to a function which takes a babel config and returns an updated babel config

### buildableProjectDepsInPackageJsonType

Default: `peerDependencies`

Type: `string`

Possible values: `dependencies`, `peerDependencies`

When updateBuildableProjectDepsInPackageJson is true, this adds dependencies to either `peerDependencies` or `dependencies`

### deleteOutputPath

Default: `true`

Type: `boolean`

Delete the output path before building.

### entryFile

Type: `string`

The path to the entry file, relative to project.

### external

Type: `array`

A list of external modules that will not be bundled (react, react-dom, etc.).

### extractCss

Default: `true`

Type: `boolean`

CSS files will be extracted to the output folder.

### globals

Type: `object[]`

A mapping of node modules to their UMD global names. Used by the UMD bundle

#### moduleId

Type: `string`

The node module to map from (e.g. `react-dom`).

#### global

Type: `string`

The global name to map to (e.g. `ReactDOM`).

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

### updateBuildableProjectDepsInPackageJson

Default: `true`

Type: `boolean`

Update buildable project dependencies in package.json

### watch

Default: `false`

Type: `boolean`

Enable re-building when files change.
