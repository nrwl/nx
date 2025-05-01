---
title: Defining a Task Pipeline
description: This recipe shows how to define task dependencies in your Nx workspace
---

# Defining a Task Pipeline

Running a specific task like `build` in a monorepo usually involves running multiple commands.

If you want to learn more about the concept of a task pipeline and its importance in a monorepo, have a look at [the What is a Task Pipeline page](/concepts/task-pipeline-configuration).

{% youtube src="https://youtu.be/_U4hu6SuBaY?si=rSclPBdRh7P_xZ_f" title="Define a task pipeline" /%}

## Define Dependencies Between Tasks

You can define dependencies among tasks by using the `dependsOn` property:

```json
// nx.json
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Per Project vs Global

Task dependencies can be [defined globally](/reference/nx-json#target-defaults) for all projects in `nx.json` file:

```json {% fileName="nx.json"%}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

Or they can be [defined per-project](/reference/project-configuration#dependson) in the `project.json` or `package.json` files. If for example you have a `prebuild` step for a given project, you can define that relationship as follows:

{% tabs %}
{% tab label="package.json" %}

```json {% fileName="apps/myapp/package.json"%}
{
  "name": "myapp",
  "dependencies": {},
  "devDependencies": {},
  ...
  "nx": {
    "targets": {
      "build": {
        "dependsOn": [
          "prebuild"
        ]
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="apps/myreactapp/project.json"%}
{
  "name": "myreactapp",
  ...
  "targets": {
    "prebuild": {
      "command": "echo Prebuild"
    },
    "build": {
      "command": "echo Build",
      "dependsOn": ["prebuild"]
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Continuous Task Dependencies

If a task has a dependency that never exits, then the task will never start. To support this scenario, you can mark the dependency as a [continuous task](/reference/project-configuration#continuous). Labeling a task as continuous tells Nx to not wait for the process to exit, and it will be run alongside its dependents.

```json {% fileName="apps/myapp/project.json" %}
{
  "targets": {
    "serve": {
      "continuous": true
    }
  }
}
```

The `continuous` option is most useful for running development servers. For example, the `e2e` task depends on a continuous `serve` task that starts the server to be tested againts.

## Visualize Task Dependencies

You can also visualize the actual task graph (alongside the projects) using [Nx graph](/features/explore-graph). This can be useful for debugging purposes.

To view the task graph in your browser, run:

```shell
npx nx graph
```

And then select "Tasks" from the top-left dropdown, choose the target (e.g. `build`, `test`,..) and either show all tasks or select a specific project you're interested in. Here's an example of the `playwright` Nx plugin `build` target (in the [Nx repo](https://github.com/nrwl/nx)).

![Task graph of the Playwright Nx plugin in the nx repo being rendered in the browser](/shared/recipes/running-tasks/task-graph-playwright-nx.webp)

Alternatively you can use the [Nx Console](/getting-started/editor-setup) extension in VSCode or IntelliJ, right-click on the project and select:

![Selecting "Focus task in Nx Graph" from the context menu in VS Code](/shared/recipes/running-tasks/task-graph-context-menu.webp)

It'll then visualize within the IDE:

![Task graph of the Playwright Nx plugin in the nx repo being rendered in VS Code](/shared/recipes/running-tasks/task-graph-vscode.webp)
