---
title: 'Node Server Tutorial - Part 3: Task-Running'
description: In this tutorial you'll create a backend-focused workspace with Nx.
---

# Node Server Tutorial - Part 3: Task-Running

Common tasks include:

- Building an application
- Serving an application locally for development purposes
- Running your unit tests
- Linting your code

When you ran your generators in Part 1, you already set up these common tasks for each project.

## Defining Targets

Here's the `project.json` file for the `auth` project:

```json {% fileName="/auth/project.json" %}
{
  "name": "auth",
  "$schema": "../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "auth/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/./auth",
        "tsConfig": "auth/tsconfig.lib.json",
        "packageJson": "auth/package.json",
        "main": "auth/src/index.ts",
        "assets": ["auth/*.md"]
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["auth/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "auth/jest.config.ts",
        "passWithNoTests": true
      },
      "configurations": {
        "ci": {
          "ci": true,
          "codeCoverage": true
        }
      }
    }
  },
  "tags": []
}
```

You can see that three targets are defined here: `build`, `test` and `lint`.

The properties of these targets are defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save for it's caching mechanisms you'll learn about in [4 - Task Pipelines](/node-server-tutorial/4-task-pipelines)).
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows for options as a way to parameterize it's functionality.

## Running Tasks

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

Run the `build` target for your `auth` project:

```{% command="npx nx build auth" path="~/products-api" %}

> nx run auth:build

Compiling TypeScript files for project "auth"...
Done compiling TypeScript files for project "auth".

 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project auth (1s)
```

You can now find your built `auth` distributable in your `dist/auth/` directory, as specified in the `outputPath` property of the `build` target options in your `project.json` file.

Next, run a lint check on `auth`:

```{% command="npx nx lint auth" path="~/products-api" %}

> nx run auth:lint


Linting "auth"...

All files pass linting.


 ———————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project products-api (777ms)
```

## Run e2e Tests

To run the e2e tests, you first need to serve the root `products-api` project:

```{% command="npx nx serve products-api" path="~/products-api" %}
> nx run products-api:serve

Debugger listening on ws://localhost:9229/5ee3e454-1e38-4d9b-a5de-64a4cb1e21b9
Debugger listening on ws://localhost:9229/5ee3e454-1e38-4d9b-a5de-64a4cb1e21b9
For help, see: https://nodejs.org/en/docs/inspector
[ ready ] http://localhost:3000
[ watch ] build succeeded, watching for changes...
```

Then you can run the e2e tests from the `e2e` project in a separate terminal:

```{% command="npx nx e2e e2e" path="~/products-api" %}
> nx run e2e:e2e

Determining test suites to run...
Setting up...

 PASS   e2e  e2e/src/server/server.spec.ts
  GET /
    ✓ should return a message (39 ms)
  POST /auth
    ✓ should return a status and a name (19 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.263 s, estimated 1 s
Ran all test suites.

Tearing down...


 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target e2e for project e2e (2s)
```

## What's Next

- Continue to [4: Task Pipelines](/node-server-tutorial/4-task-pipelines)
