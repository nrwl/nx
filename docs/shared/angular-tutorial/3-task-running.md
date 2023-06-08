# Angular Monorepo Tutorial - 3: Task-Running

Common tasks include:

- Building an application
- Serving a local web server with the built project
- Running your unit tests
- Linting your code
- Running e2e tests

When you ran your generators in Part 1, you already set up these common tasks for each project.

## Defining Targets

Here's the `project.json` file for your `common-ui` project:

```json {% fileName="libs/common-ui/project.json" %}
{
  "name": "common-ui",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "sourceRoot": "libs/common-ui/src",
  "prefix": "myorg",
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "libs/common-ui/jest.config.ts",
        "passWithNoTests": true
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "options": {
        "lintFilePatterns": [
          "libs/common-ui/**/*.ts",
          "libs/common-ui/**/*.html"
        ]
      }
    }
  },
  "tags": []
}
```

You can see that two targets are defined here: `test` and `lint`.

The properties inside each of these targets is defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save for it's caching mechanisms you'll learn about in [4 - Workspace Optimizations](/angular-tutorial/4-workspace-optimization)).
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows for options as a way to parameterize it's functionality.

## Running Tasks

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

Run the `test` target for your `common-ui` project:

```{% command="npx nx test common-ui" path="~/myorg" %}

> nx run common-ui:test

 PASS   common-ui  libs/common-ui/src/lib/banner/banner.component.spec.ts
  BannerComponent
    ✓ should create (22 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        2.192 s
Ran all test suites.

 ————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target test for project common-ui (4s)

```

Next, run a lint check on your `common-ui` project:

```{% command="npx nx lint common-ui" path="~/myorg" %}

> nx run common-ui:lint


Linting "common-ui"...

All files pass linting.


 ————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project common-ui (1s)

```

## What's Next

- Continue to [4: Workspace Optimization](/angular-tutorial/4-workspace-optimization)
