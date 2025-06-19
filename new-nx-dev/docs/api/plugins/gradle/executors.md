---
title: '@nx/gradle Executors'
description: 'Complete reference for all @nx/gradle executor commands'
sidebar_label: Executors
---

# @nx/gradle Executors

The @nx/gradle plugin provides various executors to run tasks on your gradle projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `gradle`

The Gradle Impl executor is used to run Gradle tasks.

**Usage:**

```bash
nx run &lt;project&gt;:gradle [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                     | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--taskName` **[required]** | string  | The name of the Gradle task to run.                                                                                                                             |         |
| `--args`                    | string  | The arguments to pass to the Gradle task.                                                                                                                       |         |
| `--excludeDependsOn`        | boolean | If true, the tasks will not execute its dependsOn tasks (e.g. pass --exclude-task args to gradle command). If false, the task will execute its dependsOn tasks. | `true`  |
| `--testClassName`           | string  | The full test name to run for test task (package name and class name).                                                                                          |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
