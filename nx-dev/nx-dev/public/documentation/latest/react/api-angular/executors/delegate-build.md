# delegate-build

Delegates the build to a different target while supporting incremental builds.

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/nx-cli#running-tasks.

## Properties

### buildTarget

Type: `string`

Build target used for building the app after its dependencies have been built.

### outputPath

Type: `string`

The full path for the output directory, relative to the workspace root.

### tsConfig

Type: `string`

The full path for the TypeScript configuration file, relative to the workspace root.

### watch

Default: `false`

Type: `boolean`

Run build when files change.
