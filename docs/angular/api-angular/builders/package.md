# package

Build an Angular library

Builder properties can be configured in angular.json when defining the builder, or when invoking it.

## Properties

### project

Type: `string`

The file path for the ng-packagr configuration file, relative to the current workspace.

### tsConfig

Type: `string`

The full path for the TypeScript configuration file, relative to the current workspace.

### updateBuildableProjectDepsInPackageJson

Default: `true`

Type: `boolean`

Update buildable project dependencies in package.json

### watch

Default: `false`

Type: `boolean`

Run build when files change.
