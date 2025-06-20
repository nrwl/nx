---
title: '@nx/cypress Executors'
description: 'Complete reference for all @nx/cypress executor commands'
sidebar_label: Executors
---

# @nx/cypress Executors

The @nx/cypress plugin provides various executors to run tasks on your cypress projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `cypress`

Run Cypress for e2e, integration and component testing.

**Usage:**

```bash
nx run &lt;project&gt;:cypress [options]
```

#### Options

| Option                           | Type    | Description                                                                                                                                                                                                                                                                | Default |
| -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--cypressConfig` **[required]** | string  | The path of the Cypress configuration json file.                                                                                                                                                                                                                           |         |
| `--autoCancelAfterFailures`      | string  | Specify the number of failures to cancel a run being recorded to the Cypress Cloud or `false` to disable auto-cancellation.                                                                                                                                                |         |
| `--baseUrl`                      | string  | The address (with the port) which your application is running on.                                                                                                                                                                                                          |         |
| `--browser`                      | string  | The browser to run tests in.                                                                                                                                                                                                                                               |         |
| `--ciBuildId`                    | string  | A unique identifier for a run to enable grouping or parallelization.                                                                                                                                                                                                       |         |
| `--devServerTarget`              | string  | Dev server target to run tests against.                                                                                                                                                                                                                                    |         |
| `--env`                          | object  | A key-value Pair of environment variables to pass to Cypress runner.                                                                                                                                                                                                       |         |
| `--exit`                         | boolean | Whether or not the Cypress Test Runner will stay open after running tests in a spec file.                                                                                                                                                                                  | `true`  |
| `--group`                        | string  | A named group for recorded runs in the Cypress dashboard.                                                                                                                                                                                                                  |         |
| `--headed`                       | boolean | Displays the browser instead of running headlessly. Set this to `true` if your run depends on a Chrome extension being loaded.                                                                                                                                             | `false` |
| `--headless`                     | boolean | Hide the browser instead of running headed.                                                                                                                                                                                                                                | `false` |
| `--ignoreTestFiles`              | string  | A String or Array of glob patterns used to ignore test files that would otherwise be shown in your list of tests. Cypress uses minimatch with the options: `&#123;dot: true, matchBase: true&#125;`. We suggest using https://globster.xyz to test what files would match. |         |
| `--key`                          | string  | The key cypress should use to run tests in parallel/record the run (CI only).                                                                                                                                                                                              |         |
| `--parallel`                     | boolean | Whether or not Cypress should run its tests in parallel (CI only).                                                                                                                                                                                                         | `false` |
| `--port`                         | string  | Pass a specified port value to the devServerTarget, if the value is 'cypress-auto' a free port will automatically be picked for the devServerTarget.                                                                                                                       |         |
| `--quiet`                        | boolean | If passed, Cypress output will not be printed to stdout. Only output from the configured Mocha reporter will print.                                                                                                                                                        | `false` |
| `--record`                       | boolean | Whether or not Cypress should record the results of the tests.                                                                                                                                                                                                             | `false` |
| `--reporter`                     | string  | The reporter used during cypress run.                                                                                                                                                                                                                                      |         |
| `--reporterOptions`              | string  | The reporter options used. Supported options depend on the reporter. https://docs.cypress.io/guides/tooling/reporters#Reporter-Options                                                                                                                                     |         |
| `--runnerUi`                     | boolean | Displays the Cypress Runner UI. Useful for when Test Replay is enabled and you would still like the Cypress Runner UI to be displayed for screenshots and video.                                                                                                           |         |
| `--skipServe`                    | boolean | Skip dev-server build.                                                                                                                                                                                                                                                     | `false` |
| `--spec`                         | string  | A comma delimited glob string that is provided to the Cypress runner to specify which spec files to run. i.e. `**examples/**,**actions.spec**`.                                                                                                                            |         |
| `--tag`                          | string  | A comma delimited list to identify a run with.                                                                                                                                                                                                                             |         |
| `--testingType`                  | string  | Specify the type of tests to execute.                                                                                                                                                                                                                                      | `e2e`   |
| `--watch`                        | boolean | Recompile and run tests when files change.                                                                                                                                                                                                                                 | `false` |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
