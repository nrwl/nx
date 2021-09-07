# @nrwl/react-native:sync-deps

Syncs dependencies to package.json (required for autolinking).

Options can be configured in `workspace.json` when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/getting-started/nx-cli#common-commands.

## Options

### include

Type: `string`

A comma-separated list of additional npm packages to include. e.g. 'nx sync-deps --include=react-native-gesture-handler,react-native-safe-area-context'
