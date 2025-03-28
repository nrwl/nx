---
title: 'affected - CLI command'
description: 'Run target for affected projects.'
---

# affected

Run target for affected projects.

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
 nx affected -t=build --exclude='*,!tag:dotnet'
```

Use the currently executing project name in your command:

```shell
 nx affected -t build --tag=$NX_TASK_TARGET_PROJECT:latest
```

Preview the task graph that Nx would run inside a webview:

```shell
 nx affected -t=build --graph
```

Save the task graph to a file:

```shell
 nx affected -t=build --graph=output.json
```

Print the task graph to the console:

```shell
 nx affected -t=build --graph=stdout
```

## Options

| Option                                      | Type                                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~`--all`~~                                 | boolean                                                  | **Deprecated:** Use `nx run-many` instead                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `--base`                                    | string                                                   | Base of the current branch (usually main).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `--batch`                                   | boolean                                                  | Run task(s) in batches for executors which support batches. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--configuration`, `--c`                    | string                                                   | This is the configuration to use when performing tasks on projects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--exclude`                                 | string                                                   | Exclude certain projects from being processed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `--excludeTaskDependencies`                 | boolean                                                  | Skips running dependent tasks first. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--files`                                   | string                                                   | Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `--graph`                                   | string                                                   | Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser. Pass "stdout" to print the results to the terminal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `--head`                                    | string                                                   | Latest commit of the current branch (usually HEAD).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--help`                                    | boolean                                                  | Show help.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `--nxBail`                                  | boolean                                                  | Stop command execution after the first failed task. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `--nxIgnoreCycles`                          | boolean                                                  | Ignore cycles in the task graph. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--output-style`                            | `dynamic`, `static`, `stream`, `stream-without-prefixes` | Defines how Nx emits outputs tasks logs. **dynamic**: use dynamic output life cycle, previous content is overwritten or modified as new outputs are added, display minimal logs by default, always show errors. This output format is recommended on your local development environments. **static**: uses static output life cycle, no previous content is rewritten or modified as new outputs are added. This output format is recommened for CI environments. **stream**: nx by default logs output to an internal output stream, enable this option to stream logs to stdout / stderr. **stream-without-prefixes**: nx prefixes the project name the target is running on, use this option remove the project name prefix from output. |
| `--parallel`                                | string                                                   | Max number of parallel processes [default is 3].                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `--runner`                                  | string                                                   | This is the name of the tasks runner configured in nx.json.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `--skipNxCache`, `--disableNxCache`         | boolean                                                  | Rerun the tasks even when the results are available in the cache. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `--skipRemoteCache`, `--disableRemoteCache` | boolean                                                  | Disables the remote cache. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `--skipSync`                                | boolean                                                  | Skips running the sync generators associated with the tasks. (Default: `false`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `--targets`, `--target`, `--t`              | string                                                   | Tasks to run for affected projects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `--uncommitted`                             | boolean                                                  | Uncommitted changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `--untracked`                               | boolean                                                  | Untracked changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `--verbose`                                 | boolean                                                  | Prints additional information about the commands (e.g., stack traces).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `--version`                                 | boolean                                                  | Show version number.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
