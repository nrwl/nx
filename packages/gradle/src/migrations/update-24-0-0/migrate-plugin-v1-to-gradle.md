#### Replace `@nx/gradle/plugin-v1` with `@nx/gradle`

Nx 24 removes the `@nx/gradle/plugin-v1` entry point. This migration switches every `@nx/gradle/plugin-v1` registration in `nx.json` to `@nx/gradle`. It keeps each registration's position and its `include` and `exclude` patterns.

It also maps the plugin options:

- Renames `ciTargetName` to `ciTestTargetName`. An existing `ciTestTargetName` wins.
- Removes `includeSubprojectsTasks`, which `@nx/gradle` doesn't support.
- Keeps `testTargetName`, `buildTargetName`, `classesTargetName`, and other `<taskName>TargetName` options.

`@nx/gradle` reads the project graph from the `dev.nx.gradle.project-graph` Gradle plugin. The migration applies it in the `build.gradle` or `build.gradle.kts` file next to each `settings.gradle` or `settings.gradle.kts` file.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/gradle/plugin-v1",
      "options": {
        "testTargetName": "test",
        "ciTargetName": "test-ci",
        "includeSubprojectsTasks": false
      }
    }
  ]
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/gradle",
      "options": {
        "testTargetName": "test",
        "ciTestTargetName": "test-ci"
      }
    }
  ]
}
```
