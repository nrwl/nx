# dev-server

Serve a web application

Options can be configured in `workspace.json` when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/nx-cli#running-tasks.

## Options

### buildTarget

Type: `string`

Target which builds the application

### waitUntilTargets

Default: `[]`

Type: `string`

The targets to run to before starting the node app

### host

Default: `localhost`

Type: `string`

The host to inspect the process on

### port

Default: `0`

Type: `number`

The port to inspect the process on. Setting port to 0 will assign random free ports to all forked processes.

### watch

Default: `true`

Type: `boolean`

Run build when files change

### inspect

Default: `inspect`

Type: `string` (`inspect` or `inspect-brk`) or `boolean`

Ensures the app is starting with debugging

### runtimeArgs

Default: `[]`

Type: `array<string>`

Extra args passed to the node process

### args

Default: `[]`

Type: `array<string>`

Extra args when starting the app

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application
