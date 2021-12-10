---
title: '@nrwl/react-native:component generator'
description: 'Create a component'
---

# @nrwl/react-native:component

Create a component

## Usage

```bash
nx generate component ...
```

```bash
nx g c ... # same
```

By default, Nx will search for `component` in the default collection provisioned in `angular.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react-native:component ...
```

Show what will be generated without writing to disk:

```bash
nx g component ... --dry-run
```

### Examples

Generate a component in the mylib library:

```bash
nx g component my-component --project=mylib
```

Generate a class component in the mylib library:

```bash
nx g component my-component --project=mylib --classComponent
```

## Options

### name (_**required**_)

Type: `string`

The name of the component.

### project (_**required**_)

Alias(es): p

Type: `string`

The name of the project.

### classComponent

Alias(es): C

Default: `false`

Type: `boolean`

Use class components instead of functional component.

### directory

Alias(es): d

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

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case component file name (e.g. App.tsx).

### skipTests

Default: `false`

Type: `boolean`

When true, does not create "spec.ts" test files for the new component.
