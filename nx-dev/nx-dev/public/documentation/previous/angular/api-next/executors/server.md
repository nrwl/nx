# @nrwl/next:server

Serve a Next.js app

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### buildTarget (_**required**_)

Type: `string`

Target which builds the application

### buildLibsFromSource

Default: `true`

Type: `boolean`

Read buildable libraries from source instead of building them separately.

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

### proxyConfig

Type: `string`

Path to the proxy configuration file.

### quiet

Default: `false`

Type: `boolean`

Hide error messages containing server information.

### staticMarkup

Default: `false`

Type: `boolean`

Static markup.
