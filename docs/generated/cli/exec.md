---
title: 'exec - CLI command'
description: 'Executes any command as if it was a target on the project'
---

# exec

Executes any command as if it was a target on the project

## Usage

```shell
nx exec
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### all

Type: `boolean`

Default: `true`

[deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required.

### exclude

Type: `string`

Exclude certain projects from being processed

### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser.

### help

Type: `boolean`

Show help

### nxBail

Type: `boolean`

Default: `false`

Stop command execution after the first failed task

### nxIgnoreCycles

Type: `boolean`

Default: `false`

Ignore cycles in the task graph

### parallel

Type: `string`

Max number of parallel processes [default is 3]

### projects

Type: `string`

Projects to run. (comma/space delimited project names and/or patterns)

### runner

Type: `string`

This is the name of the tasks runner configured in nx.json

### skipNxCache

Type: `boolean`

Default: `false`

Rerun the tasks even when the results are available in the cache

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number
