---
title: 'print-affected - CLI command'
description: 'Prints information about the projects and targets affected by changes'
---

# print-affected

Prints information about the projects and targets affected by changes

## Usage

```bash
nx print-affected
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Print information about affected projects and the project graph:

```bash
nx print-affected
```

Print information about the projects affected by the changes between main and HEAD (e.g,. PR):

```bash
nx print-affected --base=main --head=HEAD
```

Prints information about the affected projects and a list of tasks to test them:

```bash
nx print-affected --target=test
```

Prints the projects property from the print-affected output:

```bash
nx print-affected --target=build --select=projects
```

Prints the tasks.target.project property from the print-affected output:

```bash
nx print-affected --target=build --select=tasks.target.project
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

### runner

This is the name of the tasks runner configured in nx.json

### select

Select the subset of the returned json document (e.g., --selected=projects)

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
