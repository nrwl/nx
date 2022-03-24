---
title: '@nrwl/angular:convert-to-with-mf generator'
description:
  'Converts an old micro frontend configuration to use the new withModuleFederation helper. It will run successfully if the following conditions are met:
  - Is either a host or remote application
  - Shared npm package configurations have not been modified
  - Name used to identify the Micro Frontend application matches the project name

  _**Note:** This generator will overwrite your webpack config. If you have additional custom configuration in your config file, it will be lost!_'
---

# @nrwl/angular:convert-to-with-mf

Converts an old micro frontend configuration to use the new withModuleFederation helper. It will run successfully if the following conditions are met:

- Is either a host or remote application
- Shared npm package configurations have not been modified
- Name used to identify the Micro Frontend application matches the project name

_**Note:** This generator will overwrite your webpack config. If you have additional custom configuration in your config file, it will be lost!_

## Usage

```bash
nx generate convert-to-with-mf ...
```

By default, Nx will search for `convert-to-with-mf` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:convert-to-with-mf ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-to-with-mf ... --dry-run
```

## Options

### project

Type: `string`

The name of the micro frontend project to migrate.
