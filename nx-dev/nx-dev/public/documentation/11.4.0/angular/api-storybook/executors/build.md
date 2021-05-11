# build

Build Storybook

Properties can be configured in angular.json when defining the executor, or when invoking it.

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
