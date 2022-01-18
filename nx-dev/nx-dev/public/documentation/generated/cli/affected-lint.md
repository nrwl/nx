---
title: 'affected:lint - CLI command'
description: 'Lint projects affected by changes'
---

# affected:lint

Lint projects affected by changes

## Usage

```bash
nx affected:lint
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run lint in parallel:

```bash
nx affected:lint --parallel=5
```

Run the lint target for all projects:

```bash
nx affected:lint --all
```

Run lint for all the projects affected by changing the index.ts file:

```bash
nx affected:lint --files=libs/mylib/src/index.ts
```

Run lint for all the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:lint --base=main --head=HEAD
```

Run lint for all the projects affected by the last commit on main:

```bash
nx affected:lint --base=main~1 --head=main
```

## Options

### all

All projects

### base

Base of the current branch (usually main)

### configuration

This is the configuration to use when performing tasks on projects

### exclude

Default: ``

Exclude certain projects from being processed

### files

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### head

Latest commit of the current branch (usually HEAD)

### help

Show help

### only-failed

Default: `false`

Isolate projects which previously failed

### parallel

Max number of parallel processes [default is 3]

### runner

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

Default: `false`

Rerun the tasks even when the results are available in the cache

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Show version number
