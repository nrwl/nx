# delegate-build

Delegates the build to a different target while supporting incremental builds.

Properties can be configured in angular.json when defining the executor, or when invoking it.

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
