# ng-packagr-lite

Builds a library with support for incremental builds.

Properties can be configured in angular.json when defining the executor, or when invoking it.

## Properties

### buildableProjectDepsInPackageJsonType

Default: `peerDependencies`

Type: `string`

Possible values: `dependencies`, `peerDependencies`

When `updateBuildableProjectDepsInPackageJson` is `true`, this adds dependencies to either `peerDependencies` or `dependencies`.

### project

Type: `string`

The file path for the ng-packagr configuration file, relative to the workspace root.

### tsConfig

Type: `string`

The full path for the TypeScript configuration file, relative to the workspace root.

### updateBuildableProjectDepsInPackageJson

Default: `true`

Type: `boolean`

Whether to update the buildable project dependencies in package.json.

### watch

Default: `false`

Type: `boolean`

Whether to run a build when any file changes.
