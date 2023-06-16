---
title: 'run-many - CLI command'
description: 'Run target for multiple listed projects'
---

# run-many

Run target for multiple listed projects

## Usage

```shell
nx run-many
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Test all projects:

```shell
 nx run-many -t test
```

Test proj1 and proj2 in parallel:

```shell
 nx run-many -t test -p proj1 proj2
```

Test proj1 and proj2 in parallel using 5 workers:

```shell
 nx run-many -t test -p proj1 proj2 --parallel=5
```

Test proj1 and proj2 in sequence:

```shell
 nx run-many -t test -p proj1 proj2 --parallel=false
```

Test all projects ending with `*-app` except `excluded-app`. Note: your shell may require you to escape the `*` like this: `\*`:

```shell
 nx run-many -t test --projects=*-app --exclude excluded-app
```

Test all projects with tags starting with `api-`. Note: your shell may require you to escape the `*` like this: `\*`:

```shell
 nx run-many -t test --projects=tag:api-*
```

Test all projects with a `type:ui` tag:

```shell
 nx run-many -t test --projects=tag:type:ui
```

Test all projects with a `type:feature` or `type:ui` tag:

```shell
 nx run-many -t test --projects=tag:type:feature,tag:type:ui
```

Run lint, test, and build targets for all projects. Requires Nx v15.4+:

```shell
 nx run-many --targets=lint,test,build --all
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

Type: `string`

Exclude certain projects from being processed

### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser.

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

Projects to run. (comma/space delimited project names and/or patterns)

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

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number
