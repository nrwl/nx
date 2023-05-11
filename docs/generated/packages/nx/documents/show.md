---
title: 'show - CLI command'
description: 'Show information about the workspace (e.g., list of projects)'
---

# show

Show information about the workspace (e.g., list of projects)

## Usage

```shell
nx show
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Show all projects in the workspace:

```shell
 nx show projects
```

Show affected projects in the workspace:

```shell
 nx show projects --affected
```

Show affected projects in the workspace, excluding end-to-end projects:

```shell
 nx show projects --affected --exclude *-e2e
```

## Options

### help

Type: `boolean`

Show help

### version

Type: `boolean`

Show version number

## Subcommands

### projects

Show a list of projects in the workspace

```shell
nx show projects
```

#### Options

##### affected

Type: `boolean`

Show only affected projects

##### base

Type: `string`

Base of the current branch (usually main)

##### exclude

Type: `string`

Exclude certain projects from being processed

##### files

Type: `string`

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces

##### head

Type: `string`

Latest commit of the current branch (usually HEAD)

##### help

Type: `boolean`

Show help

##### uncommitted

Type: `boolean`

Uncommitted changes

##### untracked

Type: `boolean`

Untracked changes

##### version

Type: `boolean`

Show version number
