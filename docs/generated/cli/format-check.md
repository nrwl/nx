---
title: 'format:check - CLI command'
description: 'Check for un-formatted files'
---

# format:check

Check for un-formatted files

## Usage

```bash
nx format:check
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

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

### libs-and-apps

_boolean_

Format only libraries and applications files.

### ~~only-failed~~

_boolean_

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Isolate projects which previously failed

### projects

_array_

Projects to format (comma delimited)

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
