---
title: '@nrwl/cypress:convert-cypress-ten generator'
description: 'Convert existing Cypress e2e projects to Cypress 10'
---

# @nrwl/cypress:convert-cypress-ten

Convert existing Cypress e2e projects to Cypress 10

## Usage

```bash
nx generate convert-cypress-ten ...
```

```bash
nx g cy10 ... # same
```

By default, Nx will search for `convert-cypress-ten` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/cypress:convert-cypress-ten ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-cypress-ten ... --dry-run
```

### Examples

Convert my-cool-app-e2e to Cypress 10:

```bash
nx g @nrwl/cypress:convert-cypress-ten --project=my-cool-app-e2e
```

Convert all e2e projects in the workspace to Cypress 10:

```bash
nx g @nrwl/cypress:convert-cypress-ten --all
```

## Options

### all

Default: `false`

Type: `boolean`

Convert all projects in the workspace

### project

Type: `string`

The name of the project to convert

### targets

Type: `array`

The targets to convert
