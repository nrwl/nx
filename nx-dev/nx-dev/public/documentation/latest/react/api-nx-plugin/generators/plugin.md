---
title: '@nrwl/nx-plugin:plugin generator'
description: 'Create a Nx Plugin'
---

# @nrwl/nx-plugin:plugin

Create a Nx Plugin

## Usage

```bash
nx generate plugin ...
```

By default, Nx will search for `plugin` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nx-plugin:plugin ...
```

Show what will be generated without writing to disk:

```bash
nx g plugin ... --dry-run
```

### Examples

Generate libs/plugins/my-plugin:

```bash
nx g plugin my-plugin --directory=plugins --importPath=@myorg/my-plugin
```

## Options

### name (_**required**_)

Type: `string`

Plugin name

### directory

Alias(es): d

Type: `string`

A directory where the plugin is placed

### importPath

Type: `string`

How the plugin will be published, like @myorg/my-awesome-plugin. Note this must be a valid npm name

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`

The tool to use for running lint checks.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### skipTsConfig

Default: `false`

Type: `boolean`

Do not update tsconfig.json for development experience.

### standaloneConfig

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json

### tags

Alias(es): t

Type: `string`

Add tags to the library (used for linting)

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests
