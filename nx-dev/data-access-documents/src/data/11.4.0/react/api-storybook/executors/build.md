# build

Build Storybook

Properties can be configured in workspace.json when defining the executor, or when invoking it.
Read more about how to use executors and the CLI here: https://nx.dev/react/getting-started/cli-overview#running-tasks.

## Properties

### docsMode

Default: `false`

Type: `boolean`

Build a documentation-only site using addon-docs.

### outputPath

Type: `string`

The output path of the generated files.

### projectBuildConfig

Type: `string`

Workspace project where Storybook reads the Webpack config from

### quiet

Default: `true`

Type: `boolean`

Suppress verbose build output.

### uiFramework (**hidden**)

Default: `@storybook/angular`

Type: `string`

Storybook framework npm package
