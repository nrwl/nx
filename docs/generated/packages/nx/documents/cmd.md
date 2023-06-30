---
title: 'cmd - CLI command'
description: 'Executes a command in the root directory of projects'
---

# cmd

Executes a command in the root directory of projects

## Usage

```shell
nx cmd
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### all

Type: `boolean`

Watch all projects.

### exclude

Type: `string`

Exclude certain projects from being processed

### help

Type: `boolean`

Show help

### parallel

Type: `string`

Max number of parallel commands [default is 3]

### projects

Type: `string`

Projects on which to execute the command (comma/space delimited).

### verbose

Type: `boolean`

Run in verbose mode, where the arguments and projects to run are logged before execution.

### version

Type: `boolean`

Show version number
