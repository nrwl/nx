---
title: '@nrwl/angular:setup-tailwind generator'
description: 'Configures Tailwind CSS for an application or a buildable/publishable library.'
---

# @nrwl/angular:setup-tailwind

Configures Tailwind CSS for an application or a buildable/publishable library.

## Usage

```bash
nx generate setup-tailwind ...
```

By default, Nx will search for `setup-tailwind` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:setup-tailwind ...
```

Show what will be generated without writing to disk:

```bash
nx g setup-tailwind ... --dry-run
```

## Options

### project (_**required**_)

Type: `string`

The name of the project to add the Tailwind CSS setup for.

### buildTarget

Default: `build`

Type: `string`

The name of the target used to build the project. This option only applies to buildable/publishable libraries.

### skipFormat

Type: `boolean`

Skips formatting the workspace after the generator completes.

### skipPackageJson

Default: `false`

Type: `boolean`

Do not add dependencies to `package.json`.

### stylesEntryPoint

Type: `string`

Path to the styles entry point relative to the workspace root. If not provided the generator will do its best to find it and it will error if it can't. This option only applies to applications.
