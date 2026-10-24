#### Report when file server targets are ready

The `@nx/web:file-server` executor now tells Nx when its server is listening.
Nx listens for that report only on targets that set `readyWhen: { signal: true }`.
Tasks that depend on such a target with `waitFor: 'ready'` then start once the server is listening, instead of as soon as the target starts.

This migration sets `readyWhen: { signal: true }` on the `@nx/web:file-server` targets in your projects.
A target without its own `executor` is updated too when a `targetDefaults` entry in `nx.json` gives it `@nx/web:file-server`.

The file server runs its `buildTarget` before it listens, and that time counts against the 10-minute readiness timeout.
So the migration also adds the build target to the target's `dependsOn`, which runs the build first.
The migration reads `buildTarget`, `configurations`, and `dependsOn` from the target and from the `targetDefaults` entry that applies to it.
It leaves `dependsOn` unchanged when an entry there already names the build target.
When the target inherits `dependsOn` and sets none of its own, the migration writes `"..."` before the build target, so the inherited entries still apply.

The migration leaves a target unchanged in these cases:

- The target already sets `readyWhen`, including `null`.
- The target sets `continuous: false`, or sets no `continuous` and the `targetDefaults` entry that applies to it sets `continuous: false`. Nx only checks readiness for continuous targets.
- The `targetDefaults` entry that applies to the target sets `readyWhen`.

The migration also leaves a target unchanged when `dependsOn` can't run its build:

- A configuration of the target sets `buildTarget`. `dependsOn` applies to every configuration.
- The `buildTarget` names a configuration of the build target other than its `defaultConfiguration`. `dependsOn` can't name a configuration.
  The migration reads `defaultConfiguration` from the build target in `project.json`, and from `targetDefaults` when that build target runs an executor other than `nx:run-commands` or `nx:run-script`.
- The target has a configuration that the build target also has, other than the build target's `defaultConfiguration`. When you run the target in that configuration, `dependsOn` builds that configuration, but the file server still builds the `defaultConfiguration`.
  The migration reads the build target's configurations the same way as its `defaultConfiguration`. When the build target isn't in `project.json`, or `project.json` sets neither its `executor` nor its `command`, any configuration of the target leaves it unchanged.
- Nx can't parse the `buildTarget`, such as an empty string.

Set `readyWhen: { signal: true }` on those targets yourself, and add a `dependsOn` entry that builds the app first.

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
