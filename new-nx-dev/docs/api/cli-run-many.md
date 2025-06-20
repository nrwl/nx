---
title: nx run-many
description: 'Run target for multiple listed projects.'
---

# `nx run-many`

Run target for multiple listed projects.



## Usage

```bash
nx run-many [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--batch` | boolean | Run task(s) in batches for executors which support batches | `false` |
| `--configuration` | string | This is the configuration to use when performing tasks on projects (alias: `-c`) |  |
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |
| `--output-style` | string | Defines how Nx emits outputs tasks logs (choices: `dynamic`, `static`, `stream`, `stream-without-prefixes`) | `dynamic` |
| `--target` | string | Task to run for affected projects (alias: `-t`) |  |



