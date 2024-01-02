---
title: 'add - CLI command'
description: 'Install a plugin and initialize it.'
---

# add

Install a plugin and initialize it.

## Usage

```shell
nx add <packageSpecifier>
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Install the latest version of the `@nx/react` package and run its `@nx/react:init` generator:

```shell
 nx add @nx/react
```

Install the version `17.0.0` of the `@nx/react` package and run its `@nx/react:init` generator:

```shell
 nx add @nx/react@17.0.0
```

## Options

### help

Type: `boolean`

Show help

### packageSpecifier

Type: `string`

The name of an installed plugin to query

### version

Type: `boolean`

Show version number
