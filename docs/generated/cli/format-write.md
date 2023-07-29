---
title: 'format:write - CLI command'
description: 'Overwrite un-formatted files'
---

# format:write

Overwrite un-formatted files

## Usage

```shell
nx format:write
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### all

Type: `boolean`

Format all projects

### base

Type: `string`

Base of the current branch (usually main)

### exclude

Type: `string`

Exclude certain projects from being processed

### files

Type: `string`

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces

### head

Type: `string`

Latest commit of the current branch (usually HEAD)

### help

Type: `boolean`

Show help

### libs-and-apps

Type: `boolean`

Format only libraries and applications files.

### projects

Type: `string`

Projects to format (comma/space delimited)

### uncommitted

Type: `boolean`

Uncommitted changes

### untracked

Type: `boolean`

Untracked changes

### version

Type: `boolean`

Show version number
