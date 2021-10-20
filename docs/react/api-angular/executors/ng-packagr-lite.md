# @nrwl/angular:ng-packagr-lite

Builds a library with support for incremental builds.

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### project (_**required**_)

Type: `string`

The file path for the ng-packagr configuration file, relative to the workspace root.

### buildableProjectDepsInPackageJsonType

Default: `peerDependencies`

Type: `string`

Possible values: `dependencies`, `peerDependencies`

When `updateBuildableProjectDepsInPackageJson` is `true`, this adds dependencies to either `peerDependencies` or `dependencies`.

### fileReplacements

Type: `array`

Replace compilation source files with other compilation source files in the build.

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
