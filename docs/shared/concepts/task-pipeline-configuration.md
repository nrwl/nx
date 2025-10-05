---
title: 'What is a Task Pipeline'
description: 'Learn how Nx manages task dependencies and execution order in monorepo workspaces, ensuring proper build sequences for interconnected projects.'
---

# What is a Task Pipeline

If you have a monorepo workspace (or modularized app), you rarely just run one task. Almost certainly there are relationships among the projects in the workspace and hence tasks need to follow a certain order.

As you can see in the graph visualization below, the `myreactapp` project depends on other projects. Therefore, when running the build for `myreactapp`, these dependencies need to be built first so that `myreactapp` can use the resulting build artifacts.

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

While you could manage these relationships on your own and set up custom scripts to build all projects in the proper order (e.g. first build `shared-ui`, then `feat-products` and finally `myreactapp`), that kind of approach is not scalable and would need constant maintenance as you keep changing and adding projects to your workspace.

This becomes even more evident when you run tasks in parallel. You cannot just naively run all of them at the same time. Instead, the task orchestrator needs to respect the order of the tasks so that it builds libraries first and then resumes building the apps that depend on those libraries in parallel.

![task-graph-execution](/shared/mental-model/task-graph-execution.svg)

Nx allows you to define task dependencies in the form of "rules", which are then followed when running tasks. There's a [detailed recipe](/recipes/running-tasks/defining-task-pipeline) but here's the high-level overview:

```jsonc {% fileName="nx.json"%}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build", "prebuild"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

{% callout title="Older versions of Nx" type="warning" %}

Older versions of Nx used targetDependencies instead of targetDefaults. `targetDependencies` was removed in version 16, with `targetDefaults` replacing its use case.

{% /callout %}

When running `nx test myproj`, the above configuration would tell Nx to

1. Run the `test` command for `myproj`
2. But since there's a dependency defined from `test` to `build` (see `"dependsOn" :["build"]`), Nx runs `build` for `myproj` first.
3. `build` itself defines a dependency on `prebuild` (on the same project) as well as `build` of all the dependencies. Therefore, it will run the `prebuild` script and will run the `build` script for all the dependencies.

Note, Nx doesn't have to run all builds before it starts running tests. The task orchestrator will run as many tasks in parallel as possible as long as the constraints are met.

These rules can be defined globally in the `nx.json` file or locally per project in the `package.json` or `project.json` files.

## Configure It for Your Own Project

Learn about all the details of how to configure [task pipelines in the according recipe section](/recipes/running-tasks/defining-task-pipeline).
