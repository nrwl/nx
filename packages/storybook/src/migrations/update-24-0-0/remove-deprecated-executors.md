#### Convert `@nx/storybook` build and serve targets to inferred tasks

Nx 24 removes the `@nx/storybook:storybook` and `@nx/storybook:build` executors and their `@nrwl` aliases. The migration registers `@nx/storybook/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. It moves settings such as `docsMode` and `staticDir` into `.storybook/main.*`. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  "name": "app1",
  "targets": {
    "build-storybook": {
      "executor": "@nx/storybook:build",
      "outputs": ["{options.outputDir}"],
      "options": {
        "configDir": "apps/app1/.storybook",
        "outputDir": "dist/storybook/apps/app1"
      },
      "configurations": {}
    },
    "storybook": {
      "executor": "@nx/storybook:storybook",
      "options": {
        "port": 4400,
        "configDir": "apps/app1/.storybook"
      },
      "configurations": {
        "ci": {
          "quiet": true
        }
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  "name": "app1",
  "targets": {
    "build-storybook": {
      "options": {
        "config-dir": ".storybook",
        "output-dir": "../../dist/storybook/apps/app1"
      },
      "outputs": [
        "{projectRoot}/{options.output-dir}",
        "{projectRoot}/storybook-static",
        "{options.output-dir}",
        "{options.outputDir}",
        "{options.o}"
      ]
    },
    "storybook": {
      "configurations": {
        "ci": {
          "args": ["--quiet"]
        }
      },
      "options": {
        "config-dir": ".storybook",
        "port": 4400
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/storybook/plugin",
      "options": {
        "buildStorybookTargetName": "build-storybook",
        "serveStorybookTargetName": "storybook",
        "staticStorybookTargetName": "static-storybook",
        "testStorybookTargetName": "test-storybook"
      }
    }
  ]
}
```
