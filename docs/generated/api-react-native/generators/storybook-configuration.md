---
title: '@nrwl/react-native:storybook-configuration generator'
description: 'Set up storybook for a react-native app or library'
---

# @nrwl/react-native:storybook-configuration

Set up storybook for a react-native app or library

## Usage

```bash
nx generate storybook-configuration ...
```

By default, Nx will search for `storybook-configuration` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react-native:storybook-configuration ...
```

Show what will be generated without writing to disk:

```bash
nx g storybook-configuration ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

Project name

### generateStories

Default: `true`

Type: `boolean`

Automatically generate \*.stories.ts files for components declared in this project?

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### standaloneConfig

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json
