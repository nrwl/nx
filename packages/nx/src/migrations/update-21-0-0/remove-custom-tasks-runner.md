#### Remove Custom Tasks Runners

Removes `tasksRunnerOptions` entries from `nx.json` that contain custom tasks runners. In Nx 21, custom tasks runners are no longer functional. See https://nx.dev/deprecated/custom-tasks-runner for more information.

#### Sample Code Changes

Removes `tasksRunnerOptions` from `nx.json` if it would be empty after removing custom tasks runners.

{% tabs %}
{% tab label="Before" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {},
  "tasksRunnerOptions": {
    "default": {
      "runner": "custom-task-runner"
    }
  }
}
```

{% /tab %}
{% tab label="After" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {}
}
```

{% /tab %}
{% /tabs %}
