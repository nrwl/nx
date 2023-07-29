# React Monorepo Tutorial - 3: Task-Running

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
  "sourceRoot": "libs/common-ui/src",
  "projectType": "library",
  "tags": [],
  "targets": {
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/common-ui/**/*.{ts,tsx,js,jsx}"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/libs/common-ui"],
      "options": {
        "jestConfig": "libs/common-ui/jest.config.ts",
        "passWithNoTests": true
      }
    }
  }
}
```

You can see that two targets are defined here: `test` and `lint`.

The properties inside each of these these targets is defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save for it's caching mechanisms you'll learn about in [4 - Workspace Optimizations](/react-tutorial/4-workspace-optimization)).
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows for options as a way to parameterize it's functionality.

## Running Tasks

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

Run the `test` target for your `common-ui` project:

```{% command="npx nx test common-ui" path="~/myorg" %}

> nx run common-ui:test

 PASS   common-ui  libs/common-ui/src/lib/common-ui.spec.tsx
 PASS   common-ui  libs/common-ui/src/lib/banner/banner.spec.tsx

Test Suites: 2 passed, 2 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        0.84 s, estimated 1 s
Ran all test suites.

 ———————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target test for project common-ui (2s)
```

Next, run a lint check on your `common-ui` project:

```{% command="npx nx lint common-ui" path="~/myorg" %}

> nx run common-ui:lint


Linting "common-ui"...

All files pass linting.


———————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project common-ui (2s)
```

## What's Next

- Continue to [4: Workspace Optimization](/react-tutorial/4-workspace-optimization)
