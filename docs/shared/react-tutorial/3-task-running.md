# React Tutorial - 3: Task-Running

Now that you've created your projects in your Nx workspace, it's time to address how to run tasks in your workspace.

Common tasks for projects include:

- Building a distributable
- Serving a local web server with the built project
- Running your unit tests
- Linting your code
- Running e2e tests

When you ran your Nx generators in the first step of this tutorial, you actually already set up these more common tasks for each project.

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
      "executor": "@nrwl/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/common-ui/**/*.{ts,tsx,js,jsx}"]
      }
    },
    "test": {
      "executor": "@nrwl/jest:jest",
      "outputs": ["coverage/libs/common-ui"],
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

These targets are sufficient for your `common-ui` project, but if more targets were required in the future, you could create more targets by defining them here.

## Running Tasks in Nx

Running a target in Nx uses the following syntax:

![Syntax for Running Tasks in Nx](/shared/react-tutorial/run-target-syntax.png)

Run the `test` target for our `common-ui` project now, by running the command `npx nx test common-ui`:

```bash
% npx nx test common-ui

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

Next, run a lint check on your `common-ui` project by running the command: `npx nx lint common-ui`:

```bash
% npx nx lint common-ui

> nx run common-ui:lint


Linting "common-ui"...

All files pass linting.


———————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project common-ui (2s)
```

## What's Next

- Continue to [4: Workspace Optimization](/react-tutorial/4-workspace-optimization)
