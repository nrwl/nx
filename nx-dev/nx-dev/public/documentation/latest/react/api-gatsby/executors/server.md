# server

Starts server for app

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/cli-overview#running-tasks.

## Properties

### buildTarget

Type: `string`

Target which builds the application

### host

Default: `localhost`

Type: `string`

Host to listen on.

### https

Default: `false`

Type: `boolean`

Serve using HTTPS.

### open

Type: `boolean`

Open the site in your (default) browser for you.

### port

Default: `4200`

Type: `number`

Port to listen on.
