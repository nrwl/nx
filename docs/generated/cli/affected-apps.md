---
title: 'affected:apps - CLI command'
description: 'Print applications affected by changes'
---

# affected:apps

**Deprecated:** Use `nx print-affected --type=app ...` instead. This command will be removed in v15.

Print applications affected by changes

## Usage

```bash
nx affected:apps
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Print the names of all the apps affected by changing the index.ts file:

```bash
nx affected:apps --files=libs/mylib/src/index.ts
```

Print the names of all the apps affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:apps --base=main --head=HEAD
```

Print the names of all the apps affected by the last commit on main:

```bash
nx affected:apps --base=main~1 --head=main
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

### nx-bail

Type: boolean

Default: false

Stop command execution after the first failed task

### nx-ignore-cycles

Type: boolean

Default: false

Ignore cycles in the task graph

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

### stashed

Type: boolean

Git stashed changes

### verbose

Print additional error stack trace on failure

### version

Type: boolean

Show version number
