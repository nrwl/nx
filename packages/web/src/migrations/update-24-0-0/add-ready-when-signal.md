#### Report when file server targets are ready

The `@nx/web:file-server` executor now tells Nx when its server is listening.
Nx listens for that report only on targets that set `readyWhen: { signal: true }`.
Tasks that depend on such a target with `waitFor: 'ready'` then start once the server is listening, instead of as soon as the target starts.

This migration sets `readyWhen: { signal: true }` on every `@nx/web:file-server` target in your projects.
A target without its own `executor` is updated too when a `targetDefaults` entry in `nx.json` gives it `@nx/web:file-server`.

The file server runs its `buildTarget` before it listens, and that time counts against the 60-second readiness timeout.
So the migration also adds the build target to the target's `dependsOn`, which runs the build first.
It leaves `dependsOn` unchanged when an entry there already names the build target.

The migration leaves a target unchanged in these cases:

- The target already sets `readyWhen`, including `null`.
- The target sets `continuous: false`, or sets no `continuous` and the `targetDefaults` entry that applies to it sets `continuous: false`. Nx only checks readiness for continuous targets.
- The `targetDefaults` entry that applies to the target sets `readyWhen`.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  // ...
  "targets": {
    "serve-static": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "app1:build",
        "port": 4200
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json" {10-13}
{
  // ...
  "targets": {
    "serve-static": {
      "executor": "@nx/web:file-server",
      "options": {
        "buildTarget": "app1:build",
        "port": 4200
      },
      "readyWhen": {
        "signal": true
      },
      "dependsOn": ["build"]
    }
  }
}
```
