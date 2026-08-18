#### Add `istanbul-lib-instrument` for Karma Coverage

Angular v22 makes `istanbul-lib-instrument` an optional peer dependency of `@angular/build`, used to instrument code for Karma coverage. Since optional peers are not installed automatically, this migration adds `istanbul-lib-instrument` to `devDependencies` when the workspace has a project that runs unit tests with Karma, so Karma coverage keeps working. An existing version is preserved.

Karma usage is detected on any target using the `@angular-devkit/build-angular:karma` or `@angular/build:karma` builders, or the `@angular/build:unit-test` / `@nx/angular:unit-test` executors with the `runner` option set to `karma`. Targets that inherit their executor or `runner` from an `nx.json` `targetDefaults` entry are detected too.

#### Examples

##### `project.json`

Before:

```jsonc {5}
// project.json
{
  "targets": {
    "test": {
      "executor": "@nx/angular:unit-test",
      "options": {
        "runner": "karma",
      },
    },
  },
}
```

After (`package.json`):

```jsonc {4}
// package.json
{
  "devDependencies": {
    "istanbul-lib-instrument": "^6.0.3",
  },
}
```

##### `nx.json` (`targetDefaults`)

A project whose `test` target inherits its executor and `runner` from an `nx.json` `targetDefaults` entry is also detected:

```jsonc {7}
// nx.json
{
  "targetDefaults": {
    "test": {
      "executor": "@nx/angular:unit-test",
      "options": {
        "runner": "karma",
      },
    },
  },
}
```

```jsonc
// apps/app1/project.json
{
  "targets": {
    "test": {},
  },
}
```

`istanbul-lib-instrument` is added to `package.json` as shown above.
