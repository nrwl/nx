---
title: '@nrwl/workspace:convert-to-nx-project generator'
description: "Moves a project's configuration outside of workspace.json"
---

# @nrwl/workspace:convert-to-nx-project

Moves a project's configuration outside of workspace.json

## Usage

```bash
nx generate convert-to-nx-project ...
```

By default, Nx will search for `convert-to-nx-project` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:convert-to-nx-project ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-to-nx-project ... --dry-run
```

### Examples

Convert the my-feature-lib project to use project.json file instead of workspace.json:

```bash
nx g @nrwl/workspace:convert-to-nx-project --project my-feature-lib
```

Convert all projects in workspace.json to separate project.json files.:

```bash
nx g @nrwl/workspace:convert-to-nx-project --all
```

## Options

### all

Type: `boolean`

Should every project be converted?

### project

Type: `string`

Project name
