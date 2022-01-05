---
title: '@nrwl/angular:web-worker generator'
description: 'Creates a Web Worker.'
---

# @nrwl/angular:web-worker

Creates a Web Worker.

## Usage

```bash
nx generate web-worker ...
```

By default, Nx will search for `web-worker` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/angular:web-worker ...
```

Show what will be generated without writing to disk:

```bash
nx g web-worker ... --dry-run
```

## Options

### name (_**required**_)

Type: `string`

The name of the worker.

### project (_**required**_)

Type: `string`

The name of the project.

### path

Type: `string`

The path at which to create the worker file, relative to the current workspace.

### skipFormat

Default: `false`

Type: `boolean`

Skip formatting files.

### snippet

Default: `true`

Type: `boolean`

Add a worker creation snippet in a sibling file of the same name.
