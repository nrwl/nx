---
title: 'affected:apps - CLI command'
description: 'Print applications affected by changes'
---

# affected:apps

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

_boolean_

All projects

### base

_string_

Base of the current branch (usually main)

### configuration

_string_

This is the configuration to use when performing tasks on projects

### exclude

_array_

Default:

Exclude certain projects from being processed

### files

_array_

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### head

_string_

Latest commit of the current branch (usually HEAD)

### help

_boolean_

Show help

### ~~only-failed~~

_boolean_

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Isolate projects which previously failed

### plain

Produces a plain output for affected:apps and affected:libs

### runner

_string_

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

_boolean_

Default: false

Rerun the tasks even when the results are available in the cache

### uncommitted

_boolean_

Uncommitted changes

### untracked

_boolean_

Untracked changes

### verbose

Print additional error stack trace on failure

### version

_boolean_

Show version number
