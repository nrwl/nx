# @nrwl/react-native:sync-deps

Syncs dependencies to package.json (required for autolinking).

Options can be configured in `angular.json` when defining the executor, or when invoking it.

## Options

### include

Type: `string`

A comma-separated list of additional npm packages to include. e.g. 'nx sync-deps --include=react-native-gesture-handler,react-native-safe-area-context'
