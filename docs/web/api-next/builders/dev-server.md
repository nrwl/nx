# dev-server

Serve a Next.js app

Builder properties can be configured in workspace.json when defining the builder, or when invoking it.
Read more about how to use builders and the CLI here: https://nx.dev/web/guides/cli.

## Properties

### buildTarget

Type: `string`

Target which builds the application

### customServerPath

Type: `string`

Use a custom server script

### dev

Default: `true`

Type: `boolean`

Serve the application in the dev mode

### hostname

Type: `string`

Hostname on which the application is served.

### port

Default: `4200`

Type: `number`

Port to listen on.

### quiet

Default: `false`

Type: `boolean`

Hide error messages containing server information.

### staticMarkup

Default: `false`

Type: `boolean`

Static markup.
