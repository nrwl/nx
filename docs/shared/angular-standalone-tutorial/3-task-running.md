# Angular Standalone Tutorial - 3: Task-Running

Common tasks include:

- Building an application
- Serving a local web server with the built project
- Running your unit tests
- Linting your code
- Running e2e tests

When you ran your generators in Part 1, you already set up these common tasks for each project.

## Defining Targets

Here's the `project.json` file for your `shared-ui` project:

```json {% fileName="shared/ui/project.json" %}
{
  "name": "shared-ui",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "projectType": "library",
  "sourceRoot": "shared/ui/src",
  "prefix": "store",
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "outputs": ["{workspaceRoot}/dist/{projectRoot}"],
      "options": {
        "project": "shared/ui/ng-package.json"
      },
      "configurations": {
        "production": {
          "tsConfig": "shared/ui/tsconfig.lib.prod.json"
        },
        "development": {
          "tsConfig": "shared/ui/tsconfig.lib.json"
        }
      },
      "defaultConfiguration": "production"
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {
        "jestConfig": "shared/ui/jest.config.ts",
        "passWithNoTests": true
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "options": {
        "lintFilePatterns": ["shared/ui/**/*.ts", "shared/ui/**/*.html"]
      }
    }
  },
  "tags": []
}
```

You can see that three targets are defined here: `build`, `test` and `lint`.

The properties inside each of these these targets is defined as follows:

- `executor` - which Nx executor to run. The syntax here is: `<plugin name>:<executor name>`
- `outputs` - this is an array of files that would be created by running this target. (This informs Nx on what to save
  for it's caching mechanisms you'll learn about in [4 - Task Pipelines](/angular-standalone-tutorial/4-task-pipelines))
  .
- `options` - this is an object defining which executor options to use for the given target. Every Nx executor allows
  for options as a way to parameterize it's functionality.

## Running Tasks

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

Run the `test` target for your `shared-ui` project:

```{% command="npx nx test shared-ui" path="~/store" %}

> nx run shared-ui:test

 PASS   shared-ui  shared/ui/src/lib/banner/banner.component.spec.ts
  BannerComponent
    ✓ should create (19 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        1.561 s
Ran all test suites.

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target test for project shared-ui (3s)
```

Next, run a lint check on your `shared-ui` project:

```{% command="npx nx lint shared-ui" path="~/store" %}

> nx run shared-ui:lint


Linting "shared-ui"...

All files pass linting.


———————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target lint for project shared-ui (2s)
```

Also, by running the `serve` target for your `store` application, you can run local web server during development that
will allow you to manually check the changes you've made:

```{% command="npx nx serve store" path="~/store" %}

> nx run store:serve:development

✔ Browser application bundle generation complete.

Initial Chunk Files   | Names         |  Raw Size
vendor.js             | vendor        |   2.04 MB |
polyfills.js          | polyfills     | 316.06 kB |
styles.css, styles.js | styles        | 211.31 kB |
main.js               | main          |  47.60 kB |
runtime.js            | runtime       |  12.61 kB |

                      | Initial Total |   2.62 MB

Lazy Chunk Files      | Names         |  Raw Size
cart_src_index_ts.js  | store-cart    |   4.93 kB |

Build at: 2023-03-24T10:13:24.014Z - Hash: e52a884fc7a311e1 - Time: 8609ms

** Angular Live Development Server is listening on localhost:4200, open your browser on http://localhost:4200/ **


✔ Compiled successfully.
```

## What's Next

- Continue to [4: Workspace Optimization](/angular-standalone-tutorial/4-task-pipelines)
