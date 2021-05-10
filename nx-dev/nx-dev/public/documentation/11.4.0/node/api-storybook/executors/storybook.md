# storybook

Serve Storybook

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/node/getting-started/cli-overview#running-tasks.

## Properties

### docsMode

Default: `false`

Type: `boolean`

Build a documentation-only site using addon-docs.

### host

Default: `localhost`

Type: `string`

Host to listen on.

### port

Default: `9009`

Type: `number`

Port to listen on.

### projectBuildConfig

Type: `string`

Workspace project where Storybook reads the Webpack config from

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

### uiFramework (**hidden**)

Default: `@storybook/angular`

Type: `string`

Storybook framework npm package

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application
