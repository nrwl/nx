#### Register `@nx/js/typescript` for typecheck targets in TS solution workspaces

In TS solution workspaces, `@nx/vite/plugin` no longer infers a `typecheck` target; `@nx/js/typescript` provides it instead. Vue projects keep their `vue-tsc` typecheck target from `@nx/vite/plugin`. This migration registers `@nx/js/typescript` with only its typecheck target when the workspace uses `@nx/vite/plugin` and doesn't register `@nx/js/typescript` yet, so your projects keep a `typecheck` target.

The new registration reuses the plugin's `typecheckTargetName`. Registrations with `typecheckTargetName: false` are skipped, and workspaces that aren't TS solution setups are left unchanged.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": { "typecheckTargetName": "typecheck" }
    }
  ]
}
```

##### After

```json title="nx.json"
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": { "typecheckTargetName": "typecheck" }
    },
    {
      "plugin": "@nx/js/typescript",
      "options": { "typecheck": { "targetName": "typecheck" } }
    }
  ]
}
```
