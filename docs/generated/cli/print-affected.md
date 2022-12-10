---
title: 'print-affected - CLI command'
description: 'Prints information about the projects and targets affected by changes'
---

# print-affected

Prints information about the projects and targets affected by changes

## Usage

```terminal
nx print-affected
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Print information about affected projects and the project graph:

```terminal
 nx print-affected
```

Print information about the projects affected by the changes between main and HEAD (e.g,. PR):

```terminal
 nx print-affected --base=main --head=HEAD
```

Prints information about the affected projects and a list of tasks to test them:

```terminal
 nx print-affected --target=test
```

Prints the projects property from the print-affected output:

```terminal
 nx print-affected --target=build --select=projects
```

Prints the tasks.target.project property from the print-affected output:

```terminal
 nx print-affected --target=build --select=tasks.target.project
```

## Options

### all

Type: `boolean`

All projects

### base

Type: `string`

Base of the current branch (usually main)

### configuration

Type: `string`

This is the configuration to use when performing tasks on projects

### exclude

Type: `array`

Default: `[]`

Exclude certain projects from being processed

### files

Type: `array`

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### head

Type: `string`

Latest commit of the current branch (usually HEAD)

### help

Type: `boolean`

Show help

### select

Type: `string`

Select the subset of the returned json document (e.g., --select=projects)

### target

Type: `string`

Task to run for affected projects

### type

Type: `string`

Choices: [app, lib]

Select the type of projects to be returned (e.g., --type=app)

### uncommitted

Type: `boolean`

Uncommitted changes

### untracked

Type: `boolean`

Untracked changes

### version

Type: `boolean`

Show version number
