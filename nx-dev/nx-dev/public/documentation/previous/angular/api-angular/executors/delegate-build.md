# @nrwl/angular:delegate-build

Delegates the build to a different target while supporting incremental builds.

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### buildTarget (_**required**_)

Type: `string`

Build target used for building the application after its dependencies have been built.

### outputPath (_**required**_)

Type: `string`

The full path for the output directory, relative to the workspace root.

### tsConfig (_**required**_)

Type: `string`

The full path for the TypeScript configuration file, relative to the workspace root.

### watch

Default: `false`

Type: `boolean`

Whether to run a build when any file changes.
