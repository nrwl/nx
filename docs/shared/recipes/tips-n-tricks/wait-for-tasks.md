# Wait for Tasks to Finish

If you want to ensure that a set up task has been run before you run a particular task, you want to use the [`dependsOn` property](/reference/project-configuration#dependson).

For instance, if you have a React app called `store` and a database project called `db`, you may want to run `nx clean db` before you run `nx e2e store`.

To set that up, you would edit the `store` app's `project.json` file:

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
