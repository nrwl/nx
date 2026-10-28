#### Convert `@nx/eslint:lint` targets to inferred tasks

Nx 24 removes the `@nx/eslint:lint` executor and its `@nrwl/linter:eslint` alias. The migration registers `@nx/eslint/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Options the plugin does not infer stay on the target. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="myapp/project.json"
{
  "name": "myapp",
  "targets": {
    "lint": {
      "executor": "@nx/eslint:lint",
      "options": {
        "eslintConfig": "myapp/.eslintrc.json"
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
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```
