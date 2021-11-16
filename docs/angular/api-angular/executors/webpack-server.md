# @nrwl/angular:webpack-server

Serves a browser application with support for a custom webpack configuration.

Options can be configured in `angular.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### browserTarget (_**required**_)

Type: `string`

A browser builder target to serve in the format of `project:target[:configuration]`. You can also pass in more than one configuration name as a comma-separated list. Example: `project:target:production,staging`.

### allowedHosts

Type: `array`

List of hosts that are allowed to access the dev server.

### disableHostCheck

Default: `false`

Type: `boolean`

Don't verify connected clients are part of allowed hosts.

### hmr

Default: `false`

Type: `boolean`

Enable hot module replacement.

### host

Default: `localhost`

Type: `string`

Host to listen on.

### liveReload

Default: `true`

Type: `boolean`

Whether to reload the page on change, using live-reload.

### open

Alias(es): o

Default: `false`

Type: `boolean`

Opens the url in default browser.

### poll

Type: `number`

Enable and define the file watching poll time period in milliseconds.

### port

Default: `4200`

Type: `number`

Port to listen on.

### proxyConfig

Type: `string`

Proxy configuration file. For more information, see https://angular.io/guide/build#proxying-to-a-backend-server.

### publicHost

Type: `string`

The URL that the browser client (or live-reload client, if enabled) should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies.

### servePath

Type: `string`

The pathname where the app will be served.

### ssl

Default: `false`

Type: `boolean`

Serve using HTTPS.

### sslCert

Type: `string`

SSL certificate to use for serving HTTPS.

### sslKey

Type: `string`

SSL key to use for serving HTTPS.

### verbose

Type: `boolean`

Adds more details to output logging.

### watch

Default: `true`

Type: `boolean`

Rebuild on change.
