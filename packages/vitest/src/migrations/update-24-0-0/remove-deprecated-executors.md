#### Convert `@nx/vitest:test` targets to inferred tasks

Nx 24 removes the `@nx/vitest:test` executor. The migration registers `@nx/vitest` in `nx.json` and converts the targets that use those executors to inferred tasks. Options the plugin does not infer stay on the target. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "configFile": "myapp/vite.config.ts"
      }
    }
  }
}
```

##### After

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "test": {
      "options": {
        "config": "./vite.config.ts"
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/vitest",
      "options": {
        "testMode": "watch",
        "testTargetName": "test"
      }
    }
  ]
}
```
