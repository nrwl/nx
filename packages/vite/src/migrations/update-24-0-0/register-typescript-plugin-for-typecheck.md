#### Register `@nx/js/typescript` for typecheck targets

`@nx/vite/plugin` no longer infers a `typecheck` target, except for Vue projects, which keep their `vue-tsc` target. `@nx/js/typescript` provides the `typecheck` target instead, in all workspaces. This migration registers `@nx/js/typescript` with only its typecheck target when the workspace uses `@nx/vite/plugin` and doesn't register `@nx/js/typescript` yet, so your projects keep a `typecheck` target.

The new registration reuses the plugin's `typecheckTargetName` and, when it's `tsgo`, its `compiler`. Registrations with `typecheckTargetName: false` are skipped. `@nx/js/typescript` is registered before `@nx/vite/plugin`, so the Vue projects' `vue-tsc` target wins. Keep that order.

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
      "plugin": "@nx/js/typescript",
      "options": { "typecheck": { "targetName": "typecheck" } }
    },
    {
      "plugin": "@nx/vite/plugin",
      "options": { "typecheckTargetName": "typecheck" }
    }
  ]
}
```
