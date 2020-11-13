# file-server

Serve a web application from a folder

Builder properties can be configured in angular.json when defining the builder, or when invoking it.

## Properties

### buildTarget

Type: `string`

Target which builds the application

### host

Default: `localhost`

Type: `string`

Host to listen on.

### port

Default: `4200`

Type: `number`

Port to listen on.

### proxyUrl

Type: `string`

URL to proxy unhandled requests to.

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
