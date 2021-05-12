# package

Package a library

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/nx-cli#running-tasks.

## Properties

### ~~babelConfig~~

Type: `string`

**Deprecated:** Use the .babelrc file for project instead

Path to a function which takes a babel config and returns an updated babel config

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
