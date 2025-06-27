---
title: Wait for Tasks
description: Learn how to ensure dependent tasks are completed before running a primary task in Nx, using dependsOn property or the waitUntilTargets option for Node executors.
---

# Wait for Tasks

There are a couple ways to ensure that a set up task has been run before you run a particular task.

The most common solution is to use the [`dependsOn` property](/reference/project-configuration#dependson). This works regardless of what executor the task is using. Once the dependent tasks have completed, the primary task will start. Reference the [project configuration documentation](/reference/project-configuration#dependson) for more information.

If you are using the `@nx/js:node` executor, you can also use the [`waitUntilTargets` option](/technologies/typescript/api/executors/node#waituntiltargets) of that executor. Once the dependent tasks emit something to the console, the primary task will start.

## waitUntilTargets

If you have a Node api called `api` and a database project called `db`, you may want to run `nx serve db` any time you run `nx serve api`.

To set that up, edit the `api` app's `project.json` file:

```json {% fileName="/apps/api/project.json" %}
{
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "waitUntilTargets": ["db:serve"]
      }
    }
  }
}
```

With this configuration in place, if you run `nx serve api`, Nx will first run `nx serve db`. The `nx serve api` process will not be launched until `nx serve db` outputs something to the console. Then both processes will continue executing in parallel. When you kill the main process, both the `db` and `api` processes will be stopped.
