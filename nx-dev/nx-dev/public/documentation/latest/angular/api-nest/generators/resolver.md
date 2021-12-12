---
title: '@nrwl/nest:resolver generator'
description: 'Run the `resolver` NestJS generator with Nx project support.'
---

# @nrwl/nest:resolver

Run the `resolver` NestJS generator with Nx project support.

## Usage

```bash
nx generate resolver ...
```

By default, Nx will search for `resolver` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/nest:resolver ...
```

Show what will be generated without writing to disk:

```bash
nx g resolver ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the resolver.

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

Nest resolver language.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### unitTestRunner

Default: `jest`

Type: `string`

Possible values: `jest`, `none`

Test runner to use for unit tests.
