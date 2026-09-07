---
title: Executors and Configurations
description: Learn how Nx executors define how tasks run and how to configure them in project.json files.
filter: 'type:Guides'
topics:
  - 'Tasks & caching'
---

Executors are reusable task implementations that define how Nx runs a task.

To use an executor, install the plugin that contains the executor and then configure the executor in the project's `project.json` file.

Add a `command` when a target needs to run a shell command.
Nx normalizes this shorthand to the `nx:run-commands` executor.

```jsonc title="packages/mylib/package.json"
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "options": {
        "outputPath": "dist/apps/cart",
        ...
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        ...
      }
    }
  }
}
```

Each project has targets configured to run an executor with a specific set of options. In this snippet, `cart` has two targets defined - `build` and `test`.

Each executor definition has an `executor` property and, optionally, an `options` and a `configurations` property.

- `executor` is a string of the form `[package name]:[executor name]`. For the `build` executor, the package name is `@nx/vite` and the executor name is `build`.
- `options` is an object that contains any configuration defaults for the executor. These options vary from executor to executor.
- `configurations` allows you to create presets of options for different scenarios. All the configurations start with the properties defined in `options` as a baseline and then overwrite those options. See [Use task configurations](#use-task-configurations) below for an example.

Once configured, you can run an executor the same way you would [run any target](/docs/features/run-tasks):

```shell
nx [command] [project]
nx build cart
```

Browse the executors that are available in the [plugin registry](/docs/plugin-registry).

## Run a terminal command from an executor

If defining a new target that needs to run a single shell command, there is a shorthand for the `nx:run-commands` executor that can be used.

```jsonc title="project.json"
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "echo": {
      "command": "echo 'hello world'",
    },
  },
}
```

For multiple commands, environment variables, and working-directory options, see the
[`run-commands` executor](/docs/kb/run-commands-executor).

## Run an executor

An executor is an implementation provided by an Nx plugin.
Executors are useful when a task needs behavior that a command alone doesn't provide.
Configure one with an `executor` value in the form `<package-name>:<executor-name>`.

For example, the `@nx/js:node` executor coordinates a build target with a running Node.js process.
It rebuilds and restarts the process as source files change.

```jsonc title="packages/api/package.json"
{
  "name": "api",
  "nx": {
    "targets": {
      "serve": {
        "executor": "@nx/js:node",
        "continuous": true,
        "dependsOn": ["build"],
        "options": {
          "buildTarget": "api:build",
        },
      },
    },
  },
}
```

This target contains the following fields:

- `executor` identifies the plugin package and executor implementation.
- `options` provides default values defined by that executor's schema.
- `continuous` tells Nx that the task remains running.

Run an executor-backed target in the same way as any other target:

```shell
nx serve api
```

Browse available executors in the [plugin registry](/docs/plugin-registry).

## Use configurations

The `configurations` property defines named option overrides.
Nx merges the selected configuration into `options`, then applies command-line arguments.

```jsonc title="packages/api/package.json"
{
  "build": {
    "executor": "@nx/js:tsc",
    "outputs": ["{workspaceRoot}/dist/libs/mylib"],
    "dependsOn": ["^build"],
    "options": {
      "tsConfig": "libs/mylib/tsconfig.lib.json",
      "main": "libs/mylib/src/main.ts",
    },
    "configurations": {
      "production": {
        "tsConfig": "libs/mylib/tsconfig-prod.lib.json",
      },
    },
  },
}
```

You can select a configuration like this: `nx build mylib --configuration=production`
or `nx run mylib:build:production`.

A configuration starts with the target's `options` and overrides any values it specifies. Command-line arguments override both.

For example, if `options` sets `"sourceMap": true` and the `production` configuration sets `"sourceMap": false`, running:

```shell
nx build mylib --configuration=production
```

uses `"sourceMap": false`. Passing `--sourceMap=true` overrides it again for that run.

### Default configuration

When using multiple configurations for a given target, it's helpful to provide a default configuration.
For example, running e2e tests for multiple environments. By default it would make sense to use a `dev` configuration for day to day work, but having the ability to run against an internal staging environment for the QA team.

```json title="project.json"
{
  "e2e": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/my-app-e2e/cypress.config.ts"
    },
    "configurations": {
      "dev": {
        "devServerTarget": "my-app:serve"
      }
    }
  }
}
```

When you run `nx e2e my-app-e2e`, Nx uses the _dev_ configuration and starts the local dev server for `my-app`.
To run another configuration, pass it explicitly: `nx e2e my-app-e2e --configuration=qa` or `nx run my-app-e2e:e2e:qa`.

## Next steps

- [Run tasks](/docs/features/run-tasks) across your workspace.
- [Configure projects and targets](/docs/reference/project-configuration).
- [Create a local executor](/docs/kb/local-executors) when you need custom task behavior.
