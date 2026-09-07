---
title: Task pipeline configuration
description: Learn how to configure task dependencies so Nx runs work in the correct order and parallelizes independent tasks.
sidebar:
  order: 1
filter: 'type:Concepts'
---

Projects in a monorepo often depend on one another.
A build for an application might require build artifacts from several libraries, while unrelated
builds can run at the same time.
Nx uses the project graph and task pipeline configuration to determine that order.

In this project graph, `myreactapp` depends on `feat-products`, which depends on `shared-ui`:

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "myreactapp",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "feat-products",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "myreactapp": [
      { "source": "myreactapp", "target": "feat-products", "type": "static" }
    ],
    "shared-ui": [],
    "feat-products": [
      {
        "source": "feat-products",
        "target": "shared-ui",
        "type": "static"
      }
    ]
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

A script could build `shared-ui`, then `feat-products`, and then `myreactapp`.
That script would duplicate information already available in the project graph and would need updates
whenever project dependencies changed.

Task pipelines express the ordering rule instead.
Nx applies the rule to the current project graph and runs as many independent tasks in parallel as the
pipeline permits.

![Tasks running in dependency order and in parallel](../../../assets/concepts/mental-model/task-graph-execution.svg)

## Define task dependencies

Use `dependsOn` in `targetDefaults` to define workspace-wide task dependencies:

```jsonc title="nx.json"
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build", "prebuild"],
    },
    "test": {
      "dependsOn": ["build"],
    },
  },
}
```

With this configuration, `nx test myproj` produces the following sequence:

1. Nx adds `myproj:test` to the task graph.
1. Because `test` depends on `build`, Nx adds `myproj:build`.
1. Because `build` depends on `prebuild`, Nx adds `myproj:prebuild`.
1. The `^build` entry adds `build` tasks for projects that `myproj` depends on.
1. Nx runs each task when its dependencies are complete.

Nx doesn't wait for every build to finish before starting every test.
It runs independent tasks in parallel while respecting the graph constraints.

The caret in `^build` means "run the target on project dependencies."
Without the caret, `prebuild` and `build` refer to targets on the same project.

Define shared rules in `nx.json`.
Use the `nx.targets` section of `package.json`, or `project.json`, when one project needs a different
pipeline.

{% aside type="tip" title="Learn by doing" %}
Follow the [configuring tasks tutorial](/docs/getting-started/tutorials/configuring-tasks) to create
a task pipeline in a workspace.
{% /aside %}

For all `dependsOn` forms and project-specific examples, see
[define a task pipeline](/docs/kb/defining-task-pipeline).
