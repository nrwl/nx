---
title: '@nx/nx Executors'
description: 'Complete reference for all @nx/nx executor commands'
sidebar_label: Executors
---

# @nx/nx Executors

The @nx/nx plugin provides various executors to run tasks on your nx projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `noop`

An executor that does nothing.

**Usage:**

```bash
nx run &lt;project&gt;:noop [options]
```

### `run-commands`

Run any custom commands with Nx.

**Usage:**

```bash
nx run &lt;project&gt;:run-commands [options]
```

#### Options

| Option             | Type    | Description                                                                                                                                                                                                                                                                      | Default |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--__unparsed__`   | array   |                                                                                                                                                                                                                                                                                  |         |
| `--args`           | string  | Extra arguments. You can pass them as follows: nx run project:target --args='--wait=100'. You can then use &#123;args.wait&#125; syntax to interpolate them in the workspace config file. See example [above](#chaining-commands-interpolating-args-and-setting-the-cwd)         |         |
| `--color`          | boolean | Use colors when showing output of command.                                                                                                                                                                                                                                       | `false` |
| `--command`        | string  | Command to run in child process.                                                                                                                                                                                                                                                 |         |
| `--commands`       | array   | Commands to run in child process.                                                                                                                                                                                                                                                |         |
| `--cwd`            | string  | Current working directory of the commands. If it's not specified the commands will run in the workspace root, if a relative path is specified the commands will run in that path relative to the workspace root and if it's an absolute path the commands will run in that path. |         |
| `--env`            | object  | Environment variables that will be made available to the commands. This property has priority over the `.env` files.                                                                                                                                                             |         |
| `--envFile`        | string  | You may specify a custom .env file path.                                                                                                                                                                                                                                         |         |
| `--forwardAllArgs` | boolean | Whether arguments should be forwarded when interpolation is not present.                                                                                                                                                                                                         | `true`  |
| `--parallel`       | boolean | Run commands in parallel.                                                                                                                                                                                                                                                        | `true`  |
| `--readyWhen`      | string  | String or array of strings to appear in `stdout` or `stderr` that indicate that the task is done. When running multiple commands, this option can only be used when `parallel` is set to `true`. If not specified, the task is done when all the child processes complete.       |         |
| `--tty`            | boolean | Whether commands should be run with a tty terminal                                                                                                                                                                                                                               |         |

### `run-script`

Run any NPM script of a project in the project's root directory.

**Usage:**

```bash
nx run &lt;project&gt;:run-script [options]
```

#### Options

| Option                    | Type   | Description                                                                   | Default |
| ------------------------- | ------ | ----------------------------------------------------------------------------- | ------- |
| `--script` **[required]** | string | An npm script name in the `package.json` file of the project (e.g., `build`). |         |
| `--__unparsed__`          | array  |                                                                               |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
