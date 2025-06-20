---
title: nx run
description: 'Run a target for a project (e.g., nx run myapp:serve:production). You can also use the infix notation to run a target: (e.g., nx serve myapp --configuration=production) You can skip the use of Nx cach'
---

# `nx run`

Run a target for a project
    (e.g., nx run myapp:serve:production).

    You can also use the infix notation to run a target:
    (e.g., nx serve myapp --configuration=production)

    You can skip the use of Nx cache by using the --skip-nx-cache option.



## Usage

```bash
nx run [project][:target][:configuration] [_..] [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--batch` | boolean | Run task(s) in batches for executors which support batches | `false` |
| `--nx-bail` | boolean | Stop command execution after the first failed task |  |
| `--nx-ignore-cycles` | boolean | Ignore cycles in the task graph |  |



