---
title: '@nrwl/nest:interface generator'
description: 'Run the `interface` NestJS generator with Nx project support.'
---

# @nrwl/nest:interface

Run the `interface` NestJS generator with Nx project support.

## Usage

```bash
nx generate interface ...
```

By default, Nx will search for `interface` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:interface ...
```

Show what will be generated without writing to disk:

```bash
nx g interface ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the interface.

### project (_**required**_)

Alias(es): p

Type: `string`

The Nest project to target.

### directory

Alias(es): dir,path

Type: `string`

Directory where the generated files are placed.

### flat

Default: `true`

Type: `boolean`

Flag to indicate if a directory is created.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.
