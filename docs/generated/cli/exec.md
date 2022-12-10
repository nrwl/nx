---
title: 'exec - CLI command'
description: 'Executes any command as if it was a target on the project'
---

# exec

Executes any command as if it was a target on the project

## Usage

```terminal
nx exec
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### configuration

Type: `string`

This is the configuration to use when performing tasks on projects

### exclude

Type: `array`

Default: `[]`

Exclude certain projects from being processed

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

Choices: [dynamic, static, stream, stream-without-prefixes, compact]

Defines how Nx emits outputs tasks logs

### parallel

Type: `string`

Max number of parallel processes [default is 3]

### project

Type: `string`

Target project

### runner

Type: `string`

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

Type: `boolean`

Default: `false`

Rerun the tasks even when the results are available in the cache

### target

Type: `string`

Task to run for affected projects

### verbose

Type: `boolean`

Default: `false`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number
