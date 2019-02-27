# web-dev-server

Serve a web application

## Properties

### buildTarget

Type: `string`

Target which builds the application

### port

Default: `4200`

Type: `number`

Port to listen on.

### host

Default: `localhost`

Type: `string`

Host to listen on.

### ssl

Default: `false`

Type: `boolean`

Serve using HTTPS.

### sslKey

Type: `string`

SSL key to use for serving HTTPS.

### sslCert

Type: `string`

SSL certificate to use for serving HTTPS.

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application

### liveReload

Default: `true`

Type: `boolean`

Whether to reload the page on change, using live-reload.

### publicHost

Type: `string`

Public URL where the application will be served

### open

Default: `false`

Type: `boolean`

Open the application in the browser.
