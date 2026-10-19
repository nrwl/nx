#### Convert `@nx/playwright:playwright` targets to inferred tasks

Nx 24 removes the `@nx/playwright:playwright` executor and its `@nrwl/playwright:playwright` alias. The migration registers `@nx/playwright/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Options the plugin does not infer stay on the target. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="myapp-e2e/project.json"
{
  "name": "myapp-e2e",
  "targets": {
    "e2e": {
      "executor": "@nx/playwright:playwright",
      "outputs": ["{workspaceRoot}/dist/.playwright/myapp-e2e"],
      "options": {
        "config": "myapp-e2e/playwright.config.ts"
      }
    }
  }
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/playwright/plugin",
      "options": {
        "ciTargetName": "e2e-ci",
        "targetName": "e2e"
      }
    }
  ]
}
```
