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

Show all projects with names starting with "api-". The "projects" option is useful to see which projects would be selected by run-many.:

```shell
 nx show projects --projects api-*
```

Show all projects with a serve target:

```shell
 nx show projects --with-target serve
```

Show affected projects in the workspace:

```shell
 nx show projects --affected
```

Show affected projects in the workspace, excluding end-to-end projects:

```shell
 nx show projects --affected --exclude *-e2e
```

Show detailed information about "my-app" in a json format.:

```shell
 nx show project my-app
```

Show information about "my-app" in a human readable format.:

```shell
 nx show project my-app --json false
```

## Options

### help

Type: `boolean`

Show help

### json

Type: `boolean`

Output JSON

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

##### projects

Type: `string`

Show only projects that match a given pattern.

##### uncommitted

Type: `boolean`

Uncommitted changes

##### untracked

Type: `boolean`

Untracked changes

##### version

Type: `boolean`

Show version number

##### withTarget

Type: `string`

Show only projects that have a specific target

### project

Show a list of targets in the workspace.

```shell
nx show project <projectName>
```

#### Options

##### help

Type: `boolean`

Show help

##### projectName

Type: `string`

Show targets for the given project

##### version

Type: `boolean`

Show version number
