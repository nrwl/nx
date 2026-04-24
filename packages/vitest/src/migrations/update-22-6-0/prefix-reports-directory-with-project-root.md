#### Prefix `reportsDirectory` with `{projectRoot}`

The `reportsDirectory` option for `@nx/vitest:test` (and `@nx/vite:test`) is now resolved relative to the workspace root instead of the project root. This migration prepends `{projectRoot}/` to existing `reportsDirectory` values so the resolved path remains the same.

#### Sample Code Changes

##### Before

```json title="project.json"
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "reportsDirectory": "coverage/libs/my-lib"
      }
    }
  }
}
```

##### After

```json title="project.json" {6}
{
  "targets": {
    "test": {
      "executor": "@nx/vitest:test",
      "options": {
        "reportsDirectory": "{projectRoot}/coverage/libs/my-lib"
      }
    }
  }
}
```
