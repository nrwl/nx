---
title: '@nrwl/react:hook generator'
description: 'Create a hook'
---

# @nrwl/react:hook

Create a hook

## Usage

```bash
nx generate hook ...
```

```bash
nx g h ... # same
```

By default, Nx will search for `hook` in the default collection provisioned in `workspace.json`.

You can specify the collection explicitly as follows:

```bash
nx g @nrwl/react:hook ...
```

Show what will be generated without writing to disk:

```bash
nx g hook ... --dry-run
```

### Examples

Generate a hook in the mylib library:

```bash
nx g hook my-hook --project=mylib
```

## Options

### name (_**required**_)

Type: `string`

The name of the hook.

### project (_**required**_)

Alias(es): p

Type: `string`

The name of the project.

### directory

Alias(es): d

Type: `string`

Create the hook under this directory (can be nested).

### export

Alias(es): e

Default: `false`

Type: `boolean`

When true, the hook is exported from the project index.ts (if it exists).

### flat

Default: `false`

Type: `boolean`

Create hook at the source root rather than its own directory.

### js

Default: `false`

Type: `boolean`

Generate JavaScript files rather than TypeScript files.

### pascalCaseDirectory

Alias(es): R

Default: `false`

Type: `boolean`

Use pascal case directory name (e.g. useHook/useHook.ts).

### pascalCaseFiles

Alias(es): P

Default: `false`

Type: `boolean`

Use pascal case hook file name (e.g. useHook.ts).

### skipTests

Default: `false`

Type: `boolean`

When true, does not create "spec.ts" test files for the new hook.
