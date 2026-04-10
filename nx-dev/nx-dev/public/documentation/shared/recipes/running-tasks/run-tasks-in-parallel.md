# Run Tasks in Parallel

If you want to increase the number of processes running tasks to, say, 5 (by default, it is 3), pass the following:

```shell
npx nx build myapp --parallel=5
```

Note, you can also change the default in `nx.json`, like this:

{% tabs %}
{% tab label="Nx >= 17" %}

```json {% fileName="nx.json"%}
{
  "parallel": 5
}
```

{% /tab %}
{% tab label="Nx < 17" %}

```json {% fileName="nx.json"%}
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "parallel": 5
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}
