---
title: '@nrwl/workspace:convert-to-buildable generator'
description: 'Convert an Nx library to be buildable'
---

# @nrwl/workspace:convert-to-buildable

Convert an Nx library to be buildable

## Usage

```bash
nx generate convert-to-buildable ...
```

By default, Nx will search for `convert-to-buildable` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/workspace:convert-to-buildable ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-to-buildable ... --dry-run
```

### Examples

Convert the my-feature-lib project to be buildable:

```bash
nx g @nrwl/workspace:convert-to-buildable --project my-feature-lib
```

## Options

### project

Type: `string`

Project name

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### type

Type: `string`

Possible values: `js`, `node`, `nest`, `next`, `react`, `angular`, `detox`, `web`

The type of library that this is.
