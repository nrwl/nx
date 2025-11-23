#### Remove Custom Tasks Runners

Removes `tasksRunnerOptions` entries from `nx.json` that contain custom tasks runners. In Nx 21, custom tasks runners are no longer functional. See /deprecated/custom-tasks-runner for more information.

#### Sample Code Changes

Removes custom task runner configuration from `nx.json`.

##### Before

```json title="nx.json"
{
  "targetDefaults": {},
  "tasksRunnerOptions": {
    "default": {
      "runner": "custom-task-runner"
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {}
}
```
