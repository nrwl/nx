#### Report when Angular dev server targets are ready

Nx now knows when the Angular dev server builders are listening.
Nx listens for that report only on targets that set `readyWhen: { signal: true }`.
Tasks that depend on such a target with `waitFor: 'ready'` then start once the server is listening, instead of as soon as the target starts.

This migration sets `readyWhen: { signal: true }` on every target in your projects that uses one of these builders:

- `@angular/build:dev-server`
- `@angular-devkit/build-angular:dev-server`
- `@angular-devkit/build-angular:ssr-dev-server`
- `@nx/angular:dev-server`

A target without its own `executor` is updated too when a `targetDefaults` entry in `nx.json` gives it one of these builders.

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
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "options": {
        "buildTarget": "app1:build"
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json" {10-12}
{
  // ...
  "targets": {
    "serve": {
      "continuous": true,
      "executor": "@angular/build:dev-server",
      "options": {
        "buildTarget": "app1:build"
      },
      "readyWhen": {
        "signal": true
      }
    }
  }
}
```
