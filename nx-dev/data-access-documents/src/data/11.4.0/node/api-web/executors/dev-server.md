# dev-server

Serve a web application

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/cli-overview#running-tasks.

## Properties

### allowedHosts

Type: `string`

This option allows you to whitelist services that are allowed to access the dev server.

### baseHref

Default: `/`

Type: `string`

Base url for the application being built.

### buildTarget

Type: `string`

Target which builds the application

### host

Default: `localhost`

Type: `string`

Host to listen on.

### liveReload

Default: `true`

Type: `boolean`

Whether to reload the page on change, using live-reload.

### maxWorkers

Type: `number`

Number of workers to use for type checking.

### memoryLimit

Type: `number`

Memory limit for type checking service process in MB.

### open

Default: `false`

Type: `boolean`

Open the application in the browser.

### port

Default: `4200`

Type: `number`

Port to listen on.

### publicHost

Type: `string`

Public URL where the application will be served

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

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application
