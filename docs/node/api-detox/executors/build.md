# @nrwl/detox:build

Run the command defined in build property of the specified configuration.

Options can be configured in `workspace.json` when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/getting-started/nx-cli#common-commands.

## Options

### configPath

Alias(es): cp

Type: `string`

Specify Detox config file path. If not supplied, detox searches for .detoxrc[.js] or "detox" section in package.json

### detoxConfiguration

Alias(es): C

Type: `string`

Select a device configuration from your defined configurations, if not supplied, and there's only one configuration, detox will default to it
