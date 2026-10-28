#### Register `@nx/js/typescript` for typecheck targets

`@nx/react/router-plugin` no longer infers a `typecheck` target in any setup, and its `typecheckTargetName` option is removed. `@nx/js/typescript` provides the target instead. This migration registers `@nx/js/typescript` with only its typecheck target when the workspace uses `@nx/react/router-plugin` and doesn't register `@nx/js/typescript` yet, so your projects keep a `typecheck` target.

The new registration is added before the framework plugin and reuses its `typecheckTargetName`, and the migration then removes that option from `@nx/react/router-plugin`. Registrations with `typecheckTargetName: false` have the option removed and don't register `@nx/js/typescript`.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/react/router-plugin",
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
      "plugin": "@nx/react/router-plugin",
      "options": { "buildTargetName": "build" }
    }
  ]
}
```
