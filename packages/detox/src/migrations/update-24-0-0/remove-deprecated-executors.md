#### Convert `@nx/detox` build and test targets to inferred tasks

Nx 24 removes the `@nx/detox:build` and `@nx/detox:test` executors and their `@nrwl` aliases. The migration registers `@nx/detox/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Each converted target runs the inferred `build` or `test` target and passes its Detox configuration as an argument. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

#### Sample code changes

##### Before

```json title="apps/demo-e2e/project.json"
{
  "name": "demo-e2e",
  "targets": {
    "build-android": {
      "executor": "@nx/detox:build",
      "options": {
        "detoxConfiguration": "android.emu.debug"
      },
      "configurations": {
        "production": {
          "detoxConfiguration": "android.emu.release"
        }
      }
    },
    "test-android": {
      "executor": "@nx/detox:test",
      "options": {
        "detoxConfiguration": "android.emu.debug",
        "buildTarget": "demo-e2e:build-android"
      },
      "configurations": {
        "production": {
          "detoxConfiguration": "android.emu.release",
          "buildTarget": "demo-e2e:build-android:production"
        }
      }
    }
  }
}
```

##### After

```json title="apps/demo-e2e/project.json"
{
  "name": "demo-e2e",
  "targets": {
    "build-android": {
      "command": "nx run demo-e2e:build",
      "configurations": {
        "production": {
          "args": ["--args=\"-c android.emu.release\""]
        }
      },
      "options": {
        "args": ["--args=\"-c android.emu.debug\""]
      }
    },
    "test-android": {
      "command": "nx run demo-e2e:test",
      "configurations": {
        "production": {
          "args": ["--args=\"-c android.emu.release\""]
        }
      },
      "dependsOn": ["demo-e2e:build-android"],
      "options": {
        "args": ["--args=\"-c android.emu.debug\""]
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/detox/plugin",
      "options": {
        "buildTargetName": "build",
        "startTargetName": "start",
        "testTargetName": "test"
      }
    }
  ]
}
```
