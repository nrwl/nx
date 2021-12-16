---
title: '@nrwl/js:convert-to-swc generator'
description: 'Convert a tsc library to swc'
---

# @nrwl/js:convert-to-swc

Convert a tsc library to swc

## Usage

```bash
nx generate convert-to-swc ...
```

```bash
nx g swc ... # same
```

By default, Nx will search for `convert-to-swc` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/js:convert-to-swc ...
```

Show what will be generated without writing to disk:

```bash
nx g convert-to-swc ... --dry-run
```

### Examples

Convert libs/myapp/mylib to swc:

```bash
nx g swc mylib
```

## Options

### name (_**required**_)

Type: `string`

Library name

### targets

Type: `array`

List of targets to convert
