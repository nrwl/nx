#### Remove Custom Tasks Runners

Removes `tasksRunnerOptions` entries from `nx.json` that contain custom tasks runners. In Nx 21, custom tasks runners are no longer functional. See /deprecated/custom-tasks-runner for more information.

#### Sample Code Changes

Removes custom task runner configuration from `nx.json`.

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
