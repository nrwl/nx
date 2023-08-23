# Wait for Tasks to Finish

There are a couple ways to ensure that a set up task has been run before you run a particular task.

The most common solution is to use the [`dependsOn` property](/reference/project-configuration#dependson). This works regardless of what executor the task is using. Once the dependent tasks have completed, the primary task will start.

If you are using the `@nx/js:node` executor, you can also use the [`waitUntilTargets` option](/packages/js/executors/node#waituntiltargets) of that executor. Once the dependent tasks emit something to the console, the primary task will start.

## dependsOn

If you have a React app called `store` and a database project called `db`, you may want to run `nx clean db` before you run `nx e2e store`.

To set that up, edit the `store` app's `project.json` file:

{% tabs %}
{% tab label="Version 16+" %}

```json {% fileName="/apps/store/project.json" %}
{
  "targets": {
    "e2e": {
      "dependsOn": [
        {
          "projects": ["db"],
          "target": "clean"
        }
      ]
    }
  }
}
```

{% /tab %}
{% tab label="Version < 16" %}

```jsonc {% fileName="/apps/store/project.json" %}
{
  "targets": {
    "clean-db": {
      // Workaround task
      "command": "nx clean db"
    },
    "e2e": {
      "dependsOn": ["clean-db"] // Run clean-db on this project
    }
  }
}
```

{% /tab %}
{% /tabs %}

This will make it so that all you need to do is run `nx e2e store` and Nx will make sure that `nx clean db` is run first.

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
