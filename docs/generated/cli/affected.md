---
title: 'affected - CLI command'
description: 'Run target for affected projects'
---

# affected

Run target for affected projects

## Usage

```shell
nx affected
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Run custom target for all affected projects:

```shell
 nx affected -t custom-target
```

Run tests in parallel:

```shell
 nx affected -t test --parallel=5
```

Run the test target for all projects:

```shell
 nx affected -t test --all
```

Run lint, test, and build targets for affected projects. Requires Nx v15.4+:

```shell
 nx affected -t lint test build
```

Run tests for all the projects affected by changing the index.ts file:

```shell
 nx affected -t test --files=libs/mylib/src/index.ts
```

Run tests for all the projects affected by the changes between main and HEAD (e.g., PR):

```shell
 nx affected -t test --base=main --head=HEAD
```

Run tests for all the projects affected by the last commit on main:

```shell
 nx affected -t test --base=main~1 --head=main
```

Run build for only projects with the tag `dotnet`:

```shell
 nx affected -t build --exclude '*,!tag:dotnet'
```

Use the currently executing project name in your command.:

```shell
 nx affected -t build --tag=$NX_TASK_TARGET_PROJECT:latest
```

## Options

### ~~all~~

Type: `boolean`

**Deprecated:** Use `nx run-many` instead

### base

Type: `string`

Base of the current branch (usually main)

### configuration

Type: `string`

This is the configuration to use when performing tasks on projects

### exclude

Type: `string`

Exclude certain projects from being processed

### files

Type: `string`

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces

### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser.

### head

Type: `string`

Latest commit of the current branch (usually HEAD)

### help

Type: `boolean`

Show help

### nx-bail

Type: `boolean`

Default: `false`

Stop command execution after the first failed task

### nx-ignore-cycles

Type: `boolean`

Default: `false`

Ignore cycles in the task graph

### output-style

Type: `string`

Choices: [dynamic, static, stream, stream-without-prefixes]

Defines how Nx emits outputs tasks logs

### parallel

Type: `string`

Max number of parallel processes [default is 3]

### runner

Type: `string`

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

Type: `boolean`

Default: `false`

Rerun the tasks even when the results are available in the cache

### targets

Type: `string`

Tasks to run for affected projects

### uncommitted

Type: `boolean`

Uncommitted changes

### untracked

Type: `boolean`

Untracked changes

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number
