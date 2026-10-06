#### Add `@angular/build` When Used by an Executor

The `@nx/angular:application` and `@nx/angular:unit-test` executors load the Angular builders by importing `@angular/build` directly, and any `@angular/build:*` executor is provided by that package, so `@angular/build` is a required runtime dependency for workspaces using those targets. Nothing declares it as a direct dependency, though: it has only ever been available transitively as a dependency of `@angular-devkit/build-angular`. That is not reliable (for example, under Yarn Berry it can be missing from `node_modules` even when `@angular-devkit/build-angular` is installed), and when `@angular/build` cannot be resolved the build fails with an error like `The "@angular/build" package is required by "@nx/angular:application" but is not installed`. This migration adds `@angular/build` to `devDependencies` when a project uses one of those executors and it is not already installed, at the version the application generator installs. An existing version is preserved.

Executor usage is detected on any target using `@nx/angular:application`, `@nx/angular:unit-test`, or an `@angular/build:*` executor. Targets that inherit their executor from an `nx.json` `targetDefaults` entry are detected too.

On pnpm 11 and above, the migration also writes `pnpm-workspace.yaml`. `@angular/build` reaches four packages that run a build script on install (`esbuild`, `lmdb`, `msgpackr-extract` and `@parcel/watcher`), and pnpm 11 refuses to install a package whose script is neither allowed nor denied, so the migration records an `allowBuilds` decision for each. A decision already in the file is left untouched.

#### Examples

##### `project.json`

Before:

```jsonc {5}
// project.json
{
  "targets": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {},
    },
  },
}
```

After (`package.json`):

```jsonc {4}
// package.json
{
  "devDependencies": {
    "@angular/build": "~22.1.0",
  },
}
```

##### `nx.json` (`targetDefaults`)

A project whose `build` target inherits its executor from an `nx.json` `targetDefaults` entry is also detected:

```jsonc {5}
// nx.json
{
  "targetDefaults": {
    "build": {
      "executor": "@nx/angular:application",
      "options": {},
    },
  },
}
```

```jsonc
// apps/app1/project.json
{
  "targets": {
    "build": {},
  },
}
```

`@angular/build` is added to `package.json` as shown above.
