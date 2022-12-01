---
title: 'run-many - CLI command'
description: 'Run target for multiple listed projects'
---

# run-many

Run target for multiple listed projects

## Usage

```terminal
nx run-many
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Test all projects:

```terminal
 nx run-many --target=test
```

Test proj1 and proj2:

```terminal
 nx run-many --target=test --projects=proj1,proj2
```

Test proj1 and proj2 in parallel:

```terminal
 nx run-many --target=test --projects=proj1,proj2 --parallel=2
```

Test all projects ending with `*-app` except `excluded-app`:

```terminal
 nx run-many --target=test --projects=*-app --exclude excluded-app
```

## Options

### all

Type: `boolean`

Default: `true`

[deprecated] Run the target on all projects in the workspace

### configuration

Type: `string`

This is the configuration to use when performing tasks on projects

### exclude

Type: `array`

Default: `[]`

Exclude certain projects from being processed

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

### projects

Type: `string`

Projects to run. (comma delimited project names and/or patterns)

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
