# dev-server

Serve a Next.js app

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/react/guides/cli.

## Properties

### buildTarget

Type: `string`

Target which builds the application

### customServerTarget

Type: `string`

Target which builds a custom server

### dev

Default: `true`

Type: `boolean`

Serve the application in the dev mode

### port

Default: `4200`

Type: `number`

Port to listen on.

### quiet

Default: `false`

Type: `boolean`

Hide error messages containing server information.
