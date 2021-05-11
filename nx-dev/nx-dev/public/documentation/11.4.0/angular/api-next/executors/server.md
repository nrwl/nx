# server

Serve a Next.js app

Properties can be configured in angular.json when defining the executor, or when invoking it.

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
