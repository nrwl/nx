---
title: '@nrwl/nest:controller generator'
description: 'Run the `controller` NestJS generator with Nx project support.'
---

# @nrwl/nest:controller

Run the `controller` NestJS generator with Nx project support.

## Usage

```bash
nx generate controller ...
```

By default, Nx will search for `controller` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:controller ...
```

Show what will be generated without writing to disk:

```bash
nx g controller ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the controller.

### project (_**required**_)

Alias(es): p

Type: `string`

The Nest project to target.

### directory

Alias(es): dir,path

Type: `string`

Directory where the generated files are placed.

### flat

Default: `false`

Type: `boolean`

Flag to indicate if a directory is created.

### language

Type: `string`

Possible values: `js`, `ts`

Nest controller language.

### module

Type: `string`

Allows specification of the declaring module.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### skipImport

Default: `false`

Type: `boolean`

Flag to skip the module import.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
