---
title: 'affected:libs - CLI command'
description: 'Print libraries affected by changes'
---

# affected:libs

Print libraries affected by changes

## Usage

```bash
nx affected:libs
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Print the names of all the libs affected by changing the index.ts file:

```bash
nx affected:libs --files=libs/mylib/src/index.ts
```

Print the names of all the libs affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:libs --base=main --head=HEAD
```

Print the names of all the libs affected by the last commit on main:

```bash
nx affected:libs --base=main~1 --head=main
```

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

Default:

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

### ~~only-failed~~

Type: boolean

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Isolate projects which previously failed

### plain

Produces a plain output for affected:apps and affected:libs

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
