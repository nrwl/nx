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

### ~~aot~~

Type: `boolean`

**Deprecated:** Use the "aot" option in the browser builder instead.

Build using Ahead of Time compilation.

### ~~baseHref~~

Type: `string`

**Deprecated:** Use the "baseHref" option in the browser builder instead.

Base url for the application being built.

### ~~commonChunk~~

Type: `boolean`

**Deprecated:** Use the "commonChunk" option in the browser builder instead.

Generate a seperate bundle containing code used across multiple bundles.

### ~~deployUrl~~

Type: `string`

**Deprecated:** Use the "deployUrl" option in the browser builder instead.

URL where files will be deployed.

### disableHostCheck

Default: `false`

Type: `boolean`

Don't verify connected clients are part of allowed hosts.

### hmr

Default: `false`

Type: `boolean`

Enable hot module replacement.

### ~~hmrWarning~~

Default: `true`

Type: `boolean`

**Deprecated:** No longer has an effect.

Show a warning when the --hmr option is enabled.

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

### ~~optimization~~

Type: `boolean`

**Deprecated:** Use the "optimization" option in the browser builder instead.

Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, tree-shaking and fonts inlining. For more information, see https://angular.io/guide/workspace-config#optimization-configuration.

### poll

Type: `number`

Enable and define the file watching poll time period in milliseconds.

### port

Default: `4200`

Type: `number`

Port to listen on.

### ~~progress~~

Type: `boolean`

**Deprecated:** Use the "progress" option in the browser builder instead.

Log progress to the console while building.

### proxyConfig

Type: `string`

Proxy configuration file. For more information, see https://angular.io/guide/build#proxying-to-a-backend-server.

### publicHost

Type: `string`

The URL that the browser client (or live-reload client, if enabled) should use to connect to the development server. Use for a complex dev server setup, such as one with reverse proxies.

### servePath

Type: `string`

The pathname where the app will be served.

### ~~servePathDefaultWarning~~

Default: `true`

Type: `boolean`

**Deprecated:** No longer has an effect.

Show a warning when deploy-url/base-href use unsupported serve path values.

### ~~sourceMap~~

Type: `boolean`

**Deprecated:** Use the "sourceMap" option in the browser builder instead.

Output source maps for scripts and styles. For more information, see https://angular.io/guide/workspace-config#source-map-configuration.

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

### ~~vendorChunk~~

Type: `boolean`

**Deprecated:** Use the "vendorChunk" option in the browser builder instead.

Generate a seperate bundle containing only vendor libraries. This option should only used for development.

### verbose

Type: `boolean`

Adds more details to output logging.

### watch

Default: `true`

Type: `boolean`

Rebuild on change.
