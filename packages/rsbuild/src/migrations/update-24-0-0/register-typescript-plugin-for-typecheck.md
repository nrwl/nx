#### Register `@nx/js/typescript` for typecheck targets

`@nx/rsbuild` no longer infers a `typecheck` target in any setup, and `@nx/js/typescript` provides it instead. This migration registers `@nx/js/typescript` with only its typecheck target when the workspace uses `@nx/rsbuild` and doesn't register `@nx/js/typescript` yet, so your projects keep a `typecheck` target.

The new registration is added before the framework plugin and reuses its `typecheckTargetName`, and the migration removes that option from the `@nx/rsbuild` registration. Registrations with `typecheckTargetName: false` lose the option without registering `@nx/js/typescript`.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/rsbuild",
      "options": {
        "buildTargetName": "build",
        "typecheckTargetName": "typecheck"
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
      "plugin": "@nx/js/typescript",
      "options": { "typecheck": { "targetName": "typecheck" } }
    },
    {
      "plugin": "@nx/rsbuild",
      "options": {
        "buildTargetName": "build"
      }
    }
  ]
}
```
