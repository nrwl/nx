---
title: 'run - CLI command'
description: 'Run a target for a project
  (e.g., nx run myapp:serve:production).

  You can also use the infix notation to run a target:
  (e.g., nx serve myapp --configuration=production)

  You can skip the use of Nx cache by using the --skip-nx-cache option.'
---

# run

Run a target for a project
(e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.

## Usage

```shell
nx run [project][:target][:configuration] [_..]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Run the target build for the myapp project:

```shell
 nx run myapp:build
```

Run the target build for the myapp project, with production configuration:

```shell
 nx run myapp:build:production
```

Preview the task graph that Nx would run inside a webview:

```shell
 nx run myapp:build --graph
```

Save the task graph to a file:

```shell
 nx run myapp:build --graph=output.json
```

Print the task graph to the console:

```shell
 nx run myapp:build --graph=stdout
```

Run's a target named build:test for the myapp project. Note the quotes around the target name to prevent "test" from being considered a configuration:

```shell
 nx run myapp:"build:test"
```

## Options

### batch

Type: `boolean`

Default: `false`

Run task(s) in batches for executors which support batches

### configuration

Type: `string`

This is the configuration to use when performing tasks on projects

### exclude

Type: `string`

Exclude certain projects from being processed

### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.

### nxBail

Type: `boolean`

Default: `false`

Stop command execution after the first failed task

### nxIgnoreCycles

Type: `boolean`

Default: `false`

Ignore cycles in the task graph

### output-style

Type: `string`

Choices: [dynamic, static, stream, stream-without-prefixes, compact]

Defines how Nx emits outputs tasks logs

| option                  | description                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dynamic                 | use dynamic output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended on your local development environments. |
| static                  | uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments.                                                                         |
| stream                  | nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr                                                                                                                        |
| stream-without-prefixes | nx prefixes the project name the target is running on, use this option remove the project name prefix from output                                                                                                                   |

### parallel

Type: `string`

Max number of parallel processes [default is 3]

### project

Type: `string`

Target project

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
