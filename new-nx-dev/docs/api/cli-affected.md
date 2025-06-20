---
title: nx affected
description: 'Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.'
---

# `nx affected`

Run target for affected projects. Affected projects are projects that have been changed and projects that depend on the changed projects. See https://nx.dev/ci/features/affected for more details.



## Usage

```bash
nx affected [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--all` | boolean | No description available **⚠️ Deprecated**: Use ` |  |
| `--base` | string | Base of the current branch (usually main) |  |
| `--batch` | boolean | Run task(s) in batches for executors which support batches | `false` |
| `--configuration` | string | This is the configuration to use when performing tasks on projects (alias: `-c`) |  |
| `--files` | string | Change the way Nx is calculating the affected command |  |
| `--graph` | string | Show the task graph of the command |  |
| `--head` | string | Latest commit of the current branch (usually HEAD) |  |
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |
| `--output-style` | string | Defines how Nx emits outputs tasks logs (choices: `dynamic`, `static`, `stream`, `stream-without-prefixes`) | `dynamic` |
| `--parallel` | number | Max number of parallel processes |  |
| `--runner` | string | This is the name of the tasks runner to use |  |
| `--skip-nx-cache` | boolean | Rerun the tasks even when the results are available in the cache |  |
| `--target` | string | Task to run for affected projects (alias: `-t`) |  |
| `--uncommitted` | boolean | Uncommitted changes |  |



