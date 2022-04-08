---
title: 'format:write - CLI command'
description: 'Overwrite un-formatted files'
---

# format:write

Overwrite un-formatted files

## Usage

```bash
nx format:write
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

## Options

### all

Type: boolean

All projects

### base

Type: string

Base of the current branch (usually main)

### configuration

Type: string

This is the configuration to use when performing tasks on projects

### exclude

Type: array

Default: []

Exclude certain projects from being processed

### files

Type: array

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### head

Type: string

Latest commit of the current branch (usually HEAD)

### help

Type: boolean

Show help

### libs-and-apps

Type: boolean

Format only libraries and applications files.

### ~~only-failed~~

Type: boolean

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Isolate projects which previously failed

### projects

Type: array

Projects to format (comma delimited)

### runner

Type: string

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

Type: boolean

Default: false

Rerun the tasks even when the results are available in the cache

### uncommitted

Type: boolean

Uncommitted changes

### untracked

Type: boolean

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Type: boolean

Show version number
