---
title: 'generate - CLI command'
description: 'Runs a generator that creates and/or modifies files based on a generator from a collection.'
---

# generate

Runs a generator that creates and/or modifies files based on a generator from a collection.

## Usage

```shell
nx generate <collection:generator>
```

```shell
nx g <generator>
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Generate a new Angular application:

```shell
nx generate @nrwl/angular:app myapp
```

Generate a new React application:

```shell
nx generate @nrwl/react:app myapp
```

Generate a new web component application:

```shell
nx generate @nrwl/web:app myapp
```

Generate a new Node application:

```shell
nx generate @nrwl/node:app myapp
```

Generate a new Angular library application:

```shell
nx generate @nrwl/angular:library mylibrary
```

Generate a new React library application:

```shell
nx generate @nrwl/react:library mylibrary
```

Generate a new Node library application:

```shell
nx generate @nrwl/node:library mylibrary
```

## Options

### defaults

Default: `false`

When true, disables interactive input prompts for options with a default.

### dryRun

Default: `false`

When true, preview the changes without updating files.

### force

Default: `false`

When true, forces overwriting of existing files.

### interactive

Default: `true`

When false, disables interactive input prompts.

### help

Show help and display available generators in the default collection.

### version

Show version number
