---
title: '@nrwl/storybook:storybook executor'
description: 'Serve Storybook'
---

# @nrwl/storybook:storybook

Serve Storybook

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

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

### ~~staticDir~~

Type: `array`

**Deprecated:** In Storybook 6.4 the `--static-dir` CLI flag has been replaced with the the `staticDirs` field in `.storybook/main.js`. It will be removed completely in Storybook 7.0.

Directory where to load static files from, array of strings

### stylePreprocessorOptions.includePaths

Type: `array`

Options to pass to style preprocessors. The paths to include. Paths will be resolved to workspace root. This is for Angular projects only, as an option for the Storybook/Angular builder. It will be ignored in non-Angular projects.

### styles

Type: `array`

Global styles to be included in the build. This is for Angular projects only, as an option for the Storybook/Angular builder. It will be ignored in non-Angular projects.

### watch

Default: `true`

Type: `boolean`

Watches for changes and rebuilds application
