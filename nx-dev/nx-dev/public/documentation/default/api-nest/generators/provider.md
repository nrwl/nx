---
title: '@nrwl/nest:provider generator'
description: 'Run the `provider` NestJS generator with Nx project support.'
---

# @nrwl/nest:provider

Run the `provider` NestJS generator with Nx project support.

## Usage

```bash
nx generate provider ...
```

By default, Nx will search for `provider` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:provider ...
```

Show what will be generated without writing to disk:

```bash
nx g provider ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the provider.

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

### language

Type: `string`

Possible values: `js`, `ts`

Nest provider language.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
