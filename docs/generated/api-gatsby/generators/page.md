---
title: '@nrwl/gatsby:page generator'
description: 'Create a page'
---

# @nrwl/gatsby:page

Create a page

## Usage

```bash
nx generate page ...
```

By default, Nx will search for `page` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/gatsby:page ...
```

Show what will be generated without writing to disk:

```bash
nx g page ... --dry-run
```

### Examples

Generate a page in the mylib library:

```bash
nx g page my-page --project=mylib
```

Generate a class component in the mylib library:

```bash
nx g page my-page --project=mylib --classComponent
```

## Options

### name (_**required**_)

Type: `string`

The name of the component.

### project (_**required**_)

Alias(es): p

Type: `string`

The name of the project.

### directory

Alias(es): dir

Type: `string`

Create the component under this directory (can be nested).

### export

Alias(es): e

Default: `false`

Type: `boolean`

When true, the component is exported from the project index.ts (if it exists).

### flat

Default: `false`

Type: `boolean`

Create component at the source root rather than its own directory.

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### skipTests

Default: `false`

Type: `boolean`

When true, does not create "spec.ts" test files for the new component.

### style

Alias(es): s

Default: `css`

Type: `string`

Possible values: `css`, `scss`, `styl`, `less`, `styled-components`, `@emotion/styled`, `styled-jsx`, `none`

The file extension to be used for style files.
