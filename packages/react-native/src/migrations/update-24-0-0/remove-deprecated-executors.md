#### Convert `@nx/react-native` targets to inferred tasks

Nx 24 removes the `@nx/react-native:build-android`, `@nx/react-native:build-ios`, `@nx/react-native:bundle`, `@nx/react-native:pod-install`, `@nx/react-native:run-android`, `@nx/react-native:run-ios`, `@nx/react-native:start` and `@nx/react-native:upgrade` executors and their `@nrwl` aliases. The migration registers `@nx/react-native/plugin` in `nx.json` and converts the targets that use those executors to inferred tasks. Executor options become command-line arguments of the inferred tasks. The converter does not handle `bundle` targets, so they are left for manual conversion. A target with nothing left to override is removed from project configuration. When several projects share the same remaining options, those options move to a `targetDefaults` entry scoped to the plugin. `targetDefaults` entries keyed by a removed executor are removed once no target uses that executor.

The migration lists the targets the converter cannot convert safely. In agentic runs, an AI prompt finishes them and validates the project graph.

The `@nx/react-native:storybook`, `@nx/react-native:sync-deps` and `@nx/react-native:ensure-symlink` executors stay.

#### Sample code changes

The `build-android` target is removed because it matches the inferred target. The `bundle-android` target keeps its executor.

##### Before

```json title="apps/demo/project.json"
{
  "name": "demo",
  "targets": {
    "build-android": {
      "executor": "@nx/react-native:build-android",
      "options": {}
    },
    "bundle-android": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "platform": "android"
      }
    }
  }
}
```

##### After

```json title="apps/demo/project.json"
{
  "name": "demo",
  "targets": {
    "bundle-android": {
      "executor": "@nx/react-native:bundle",
      "options": {
        "platform": "android"
      }
    }
  }
}
```

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/react-native/plugin",
      "options": {
        "buildAndroidTargetName": "build-android",
        "buildIosTargetName": "build-ios",
        "bundleTargetName": "bundle",
        "podInstallTargetName": "pod-install",
        "runAndroidTargetName": "run-android",
        "runIosTargetName": "run-ios",
        "startTargetName": "start",
        "syncDepsTargetName": "sync-deps",
        "upgradeTargetName": "upgrade"
      }
    }
  ]
}
```
