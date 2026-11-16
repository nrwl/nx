#### Convert `@nx/expo` targets to inferred tasks

Nx 24 removes the `@nx/expo:build`, `@nx/expo:export`, `@nx/expo:install`, `@nx/expo:prebuild`, `@nx/expo:run`, `@nx/expo:serve`, `@nx/expo:start` and `@nx/expo:submit` executors and their `@nrwl` aliases. The migration registers `@nx/expo/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Executor options become command-line arguments of the inferred tasks. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

The `@nx/expo:build-list`, `@nx/expo:sync-deps`, `@nx/expo:update` and `@nx/expo:ensure-symlink` executors stay.

The inferred `install` and `prebuild` tasks run `expo install` and `expo prebuild` as they are. `@nx/expo:install` installed packages into the root `package.json` and then synced them into the app's. The inferred `install` runs in the app directory, so packages go into the app's `package.json` and no longer into the root one. To keep dependencies in the root `package.json`, install them there and sync them with the kept `@nx/expo:sync-deps` executor. `@nx/expo:prebuild` ran `expo prebuild --no-install` and then installed packages and CocoaPods itself, which `expo prebuild` does by default.

`@nx/expo:build` copied the root dependencies and lock file into the app before `eas build`. The `add-eas-build-pre-install` migration moves that step to an `eas-build-pre-install` script that EAS Build runs.

#### Sample code changes

The `install` target has no options that differ from the inferred target, so it is removed. The `export` options become CLI arguments.

##### Before

```json title="apps/demo/project.json"
{
  "name": "demo",
  "targets": {
    "export": {
      "executor": "@nx/expo:export",
      "options": {
        "platform": "all",
        "outputDir": "dist/demo"
      }
    },
    "install": {
      "executor": "@nx/expo:install",
      "options": {}
    }
  }
}
```

##### After

```json title="apps/demo/project.json"
{
  "name": "demo",
  "targets": {
    "export": {
      "options": {
        "args": ["--output-dir=../../dist/demo", "--platform=all"]
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/expo/plugin",
      "options": {
        "buildTargetName": "build",
        "exportTargetName": "export",
        "installTargetName": "install",
        "prebuildTargetName": "prebuild",
        "runAndroidTargetName": "run-android",
        "runIosTargetName": "run-ios",
        "serveTargetName": "serve",
        "startTargetName": "start",
        "submitTargetName": "submit"
      }
    }
  ]
}
```
