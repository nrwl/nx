---
title: '@nrwl/storybook:build executor'
description: 'Build Storybook'
---

# @nrwl/storybook:build

Build Storybook

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### uiFramework (_**required**_) (**hidden**)

Default: `@storybook/angular`

Type: `string`

Storybook framework npm package

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

### stylePreprocessorOptions.includePaths

Type: `array`

Options to pass to style preprocessors. The paths to include. Paths will be resolved to workspace root. This is for Angular projects only, as an option for the Storybook/Angular builder. It will be ignored in non-Angular projects.

### styles

Type: `array`

Global styles to be included in the build. This is for Angular projects only, as an option for the Storybook/Angular builder. It will be ignored in non-Angular projects.
