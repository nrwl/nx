# storybook

Serve Storybook

## Properties

### host

Default: `localhost`

Type: `string`

Host to listen on.

### port

Default: `9009`

Type: `number`

Port to listen on.

### quiet

Default: `true`

Type: `boolean`

Suppress verbose build output.

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

### staticDir

Type: `array`

Directory where to load static files from, array of strings

### uiFramework

Type: `string`

Storybook framework npm package

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application
