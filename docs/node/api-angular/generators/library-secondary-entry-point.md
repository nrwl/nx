---
title: '@nrwl/angular:library-secondary-entry-point generator'
description: 'Creates a secondary entry point for an Angular publishable library.'
---

# @nrwl/angular:library-secondary-entry-point

Creates a secondary entry point for an Angular publishable library.

## Usage

```bash
nx generate library-secondary-entry-point ...
```

```bash
nx g secondary-entry-point ... # same
```

By default, Nx will search for `library-secondary-entry-point` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:library-secondary-entry-point ...
```

Show what will be generated without writing to disk:

```bash
nx g library-secondary-entry-point ... --dry-run
```

## Options

### library (_**required**_)

Type: `string`

The name of the library to create the secondary entry point for.

### name (_**required**_)

Type: `string`

The name of the secondary entry point.

### skipModule

Default: `false`

Type: `boolean`

Skip generating a module for the secondary entry point.
