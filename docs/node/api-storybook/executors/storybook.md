# @nrwl/storybook:storybook

Serve Storybook

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### uiFramework (_**required**_) (**hidden**)

Default: `@storybook/angular`

Type: `string`

Possible values: `@storybook/angular`, `@storybook/react`, `@storybook/html`, `@storybook/web-components`, `@storybook/vue`, `@storybook/vue3`, `@storybook/svelte`

Storybook framework npm package

### docsMode

Default: `false`

Type: `boolean`

Build a documentation-only site using addon-docs.

### host

Default: `localhost`

Type: `string`

Host to listen on.

### https

Default: `false`

Type: `boolean`

Serve using HTTPS.

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

### sslCert

Type: `string`

SSL certificate to use for serving HTTPS.

### sslKey

Type: `string`

SSL key to use for serving HTTPS.

### staticDir

Type: `array`

Directory where to load static files from, array of strings

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application
