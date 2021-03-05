# Using Executors / Builders

Executors perform actions on your code. This can include building, linting, testing, serving and many other actions.

Executors can be written using `@nrwl/devkit` or `@angular-devkit`. Executors written with the `@angular-devkit` are called Builders.

There are two main differences between an executor and a shell script or an npm script:

1. Executors encourage a consistent methodology for performing similar actions on unrelated projects. i.e. A developer switching between teams can be confident that `nx build project2` will build `project2` with the default settings, just like `nx build project1` built `project1`.
2. Nx can leverage this consistency to perform the same executor across multiple projects. i.e. `nx affected --target==test` will run the `test` executor on every project that is affected by the current code change.

## Executor Definitions

The executors that are available for each project are defined and configured in the `/workspace.json` file.

```json
{
  "projects": {
    "cart": {
      "root": "apps/cart",
      "sourceRoot": "apps/cart/src",
      "projectType": "application",
      "generators": {},
      "targets": {
        "build": {
          "executor": "@nrwl/web:build",
          "options": {
            "outputPath": "dist/apps/cart",
            ...
          },
          "configurations": {
            "production": {
              "sourceMap": false,
              ...
            }
          }
        },
        "test": {
          "executor": "@nrwl/jest:jest",
          "options": {
            ...
          }
        }
      }
    }
  }
}
```

> Note: There are a few property keys in `workspace.json` that have interchangeable aliases. You can replace `generators` with `schematics`, `targets` with `architect` or `executor` with `builder`.

Each project has its executors defined in the `targets` property. In this snippet, `cart` has two executors defined - `build` and `test`.

> Note: `build` and `test` can be any strings you choose. For the sake of consistency, we make `test` run unit tests for every project and `build` produce compiled code for the projects which can be built.

Each executor definition has an `executor` property and, optionally, an `options` and a `configurations` property.

- `executor` is a string of the from `[package name]:[executor name]`. For the `build` executor, the package name is `@nrwl/web` and the executor name is `build`.
- `options` is an object that contains any configuration defaults for the executor. These options vary from executor to executor.
- `configurations` allows you to create presets of options for different scenarios. All the configurations start with the properties defined in `options` as a baseline and then overwrite those options. In the example, there is a `production` configuration that overrides the default options to set `sourceMap` to `false`.

## Running Executors

The [`nx run`](/{{framework}}/cli/run) cli command (or the shorthand versions) can be used to run executors.

```bash
nx run [project]:[command]
nx run cart:build
```

As long as your command name doesn't conflict with an existing nx cli command, you can use this short hand:

```bash
nx [command] [project]
nx build cart
```

You can also use a specific configuration preset like this:

```bash
nx [command] [project] --configuration=[configuration]
nx build cart --configuration=production
```

Or you can overwrite individual executor options like this:

```bash
nx [command] [project] --[optionNameInCamelCase]=[value]
nx build cart --outputPath=some/other/path
```

## See Also

- [`nx affected`](/{{framework}}/cli/affected)
- [`nx run-many`](/{{framework}}/cli/run-many)
