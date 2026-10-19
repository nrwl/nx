#### Convert `@nx/cypress:cypress` targets to inferred tasks

Nx 24 removes the `@nx/cypress:cypress` executor and its `@nrwl/cypress:cypress` alias. The migration registers `@nx/cypress/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. It moves the dev server and `baseUrl` settings into `cypress.config.*`. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="myapp-e2e/project.json"
{
  "name": "myapp-e2e",
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "myapp-e2e/cypress.config.ts",
        "testingType": "e2e",
        "devServerTarget": "myapp:serve"
      },
      "configurations": {
        "ci": {
          "devServerTarget": "myapp:static-serve"
        }
      }
    }
  }
}
```

##### After

```json title="myapp-e2e/project.json"
{
  "name": "myapp-e2e",
  "targets": {
    "e2e": {
      "options": {
        "config-file": "./cypress.config.ts"
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/cypress/plugin",
      "options": {
        "ciTargetName": "e2e-ci",
        "componentTestingTargetName": "component-test",
        "openTargetName": "open-cypress",
        "targetName": "e2e"
      }
    }
  ]
}
```
