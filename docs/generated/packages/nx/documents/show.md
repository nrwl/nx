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

Show all projects with names starting with "api-". The "projects" option is useful to see which projects would be selected by run-many:

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

Show affected apps in the workspace:

```shell
 nx show projects --affected --type app
```

Show affected projects in the workspace, excluding end-to-end projects:

```shell
 nx show projects --affected --exclude=*-e2e
```

If in an interactive terminal, opens the project detail view. If not in an interactive terminal, defaults to JSON:

```shell
 nx show project my-app
```

Show detailed information about "my-app" in a json format:

```shell
 nx show project my-app --json
```

Show information about "my-app" in a human readable format:

```shell
 nx show project my-app --json false
```

Opens a web browser to explore the configuration of "my-app":

```shell
 nx show project my-app --web
```

## Shared Options

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

##### sep

Type: `string`

Outputs projects with the specified seperator

##### type

Type: `string`

Choices: [app, lib, e2e]

Select only projects of the given type

##### uncommitted

Type: `boolean`

Uncommitted changes

##### untracked

Type: `boolean`

Untracked changes

##### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

##### version

Type: `boolean`

Show version number

##### withTarget

Type: `string`

Show only projects that have a specific target

### project

Shows resolved project configuration for a given project.

```shell
nx show project <projectName>
```

#### Options

##### help

Type: `boolean`

Show help

##### open

Type: `boolean`

Set to false to prevent the browser from opening when using --web

##### projectName

Type: `string`

Which project should be viewed?

##### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

##### version

Type: `boolean`

Show version number

##### web

Type: `boolean`

Show project details in the browser. (default when interactive)
