---
title: '@nrwl/react-native:storybook executor'
description: 'Serve React Native Storybook'
---

# @nrwl/react-native:storybook

Serve React Native Storybook

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### outputFile (_**required**_)

Default: `./.storybook/story-loader.js`

Type: `string`

The output file that will be written. It is relative to the project directory.

### pattern (_**required**_)

Default: `**/*.stories.@(js|jsx|ts|tsx|md)`

Type: `string`

The pattern of files to look at. It can be a specific file, or any valid glob. Note: if using the CLI, globs with \*_/_... must be escaped with quotes

### searchDir (_**required**_)

Type: `string`

The directory or directories, relative to the project root, to search for files in.

### silent

Default: `false`

Type: `boolean`

Silences output.
