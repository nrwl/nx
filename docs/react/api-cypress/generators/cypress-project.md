---
title: '@nrwl/cypress:cypress-project generator'
description: 'Add a Cypress E2E Project'
---

# @nrwl/cypress:cypress-project

Add a Cypress E2E Project

## Usage

```bash
nx generate cypress-project ...
```

By default, Nx will search for `cypress-project` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/cypress:cypress-project ...
```

Show what will be generated without writing to disk:

```bash
nx g cypress-project ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

Name of the E2E Project

### baseUrl

Type: `string`

The address (with the port) which your application is running on

### directory

Type: `string`

A directory where the project is placed

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files

### linter

Default: `eslint`

Type: `string`

Possible values: `eslint`, `tslint`, `none`

The tool to use for running lint checks.

### project

Type: `string`

The name of the frontend project to test.

### setParserOptionsProject

Default: `false`

Type: `boolean`

Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files

### standaloneConfig

Type: `boolean`

Split the project configuration into <projectRoot>/project.json rather than including it inside workspace.json
