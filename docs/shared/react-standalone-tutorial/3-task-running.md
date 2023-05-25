# React Standalone Tutorial - 3: Task-Running

Common tasks include:

- Building an application
- Serving a local web server with the built project
- Running your unit tests
- Linting your code
- Running e2e tests

When you ran your generators in Part 1, you already set up these common tasks for each project.

## Defining Targets

Here's the `project.json` file for your `shared-ui` project:

```json {% fileName="libs/common-ui/project.json" %}
{
  "name": "shared-ui",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "shared/ui/src",
  "projectType": "library",
  "tags": [],
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/shared/ui"
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["shared/ui/**/*.{ts,tsx,js,jsx}"]
      }
    },
    "test": {
      "executor": "@nx/vite:test",
      "outputs": ["{projectRoot}/coverage"],
      "options": {
        "passWithNoTests": true
      }
    }
  }
}
```

You can see that three targets are defined here: `build`, `test` and `lint`.

The properties inside each of these these targets is defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save for it's caching mechanisms you'll learn about in [4 - Task Pipelines](/react-standalone-tutorial/4-task-pipelines)).
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows for options as a way to parameterize it's functionality.

## Running Tasks

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

Run the `test` target for your `shared-ui` project:

```{% command="npx nx test shared-ui" path="~/store" %}

> nx run shared-ui:test

 RUN  v0.25.3 /Users/isaac/Documents/code/store/shared/ui
 ✓ src/lib/banner/banner.spec.tsx  (1 test) 12ms
 ✓ src/lib/shared-ui.spec.tsx  (1 test) 10ms
 Test Files  2 passed (2)
      Tests  2 passed (2)
   Start at  15:00:09
   Duration  1.05s (transform 375ms, setup 1ms, collect 415ms, tests 22ms)

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target test for project shared-ui (2s)
```

Next, run a lint check on your `shared-ui` project:

```{% command="npx nx lint shared-ui" path="~/store" %}

> nx run shared-ui:lint


Linting "shared-ui"...

All files pass linting.


———————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project shared-ui (2s)
```

## What's Next

- Continue to [4: Task Pipelines](/react-standalone-tutorial/4-task-pipelines)
