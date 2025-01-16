---
title: 'run-many - CLI command'
description: 'Run target for multiple listed projects.'
---

# run-many

Run target for multiple listed projects.

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
 nx run-many --targets=lint,test,build
```

Preview the task graph that Nx would run inside a webview:

```shell
 nx run-many -t=build --graph
```

Save the task graph to a file:

```shell
 nx run-many -t=build --graph=output.json
```

Print the task graph to the console:

```shell
 nx run-many -t=build --graph=stdout
```

## Options

| Option                                      | Type                                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--all`                                     | boolean                                                  | [deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required. (Default: `true`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--batch`                                   | boolean                                                  | Run task(s) in batches for executors which support batches. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--configuration`, `--c`                    | string                                                   | This is the configuration to use when performing tasks on projects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--exclude`                                 | string                                                   | Exclude certain projects from being processed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--excludeTaskDependencies`                 | boolean                                                  | Skips running dependent tasks first. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--graph`                                   | string                                                   | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `--help`                                    | boolean                                                  | Show help.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `--nxBail`                                  | boolean                                                  | Stop command execution after the first failed task. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `--nxIgnoreCycles`                          | boolean                                                  | Ignore cycles in the task graph. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--output-style`                            | `dynamic`, `static`, `stream`, `stream-without-prefixes` | Defines how Nx emits outputs tasks logs. **dynamic**: use dynamic output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended on your local development environments. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. |
| `--parallel`                                | string                                                   | Max number of parallel processes [default is 3].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `--projects`, `--p`                         | string                                                   | Projects to run. (comma/space delimited project names and/or patterns).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--runner`                                  | string                                                   | This is the name of the tasks runner configured in nx.json.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--skipNxCache`, `--disableNxCache`         | boolean                                                  | Rerun the tasks even when the results are available in the cache. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean                                                  | Disables the remote cache. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `--skipSync`                                | boolean                                                  | Skips running the sync generators associated with the tasks. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `--targets`, `--target`, `--t`              | string                                                   | Tasks to run for affected projects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--verbose`                                 | boolean                                                  | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `--version`                                 | boolean                                                  | Show version number.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
