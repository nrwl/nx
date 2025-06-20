---
title: '@nx/playwright Executors'
description: 'Complete reference for all @nx/playwright executor commands'
sidebar_label: Executors
---

# @nx/playwright Executors

The @nx/playwright plugin provides various executors to run tasks on your playwright projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `playwright`

Run Playwright tests.

**Usage:**

```bash
nx run &lt;project&gt;:playwright [options]
```

#### Options

| Option              | Type    | Description                                                                                                                                                                                    | Default |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--browser`         | string  | Browser to use for tests, one of 'all', 'chromium', 'firefox' or 'webkit'. If a playwright config is provided/discovered then the browserName value is expected from the configured 'projects' |         |
| `--config`          | string  | Configuration file, or a test directory with optional                                                                                                                                          |         |
| `--debug`           | boolean | Run tests with Playwright Inspector. Shortcut for 'PWDEBUG=1' environment variable and '--timeout=0',--max-failures=1 --headed --workers=1' options                                            |         |
| `--forbidOnly`      | boolean | Fail if test.only is called                                                                                                                                                                    |         |
| `--fullyParallel`   | boolean | Run all tests in parallel                                                                                                                                                                      |         |
| `--globalTimeout`   | number  | Maximum time this test suite can run in milliseconds                                                                                                                                           |         |
| `--grep`            | string  | Only run tests matching this regular expression                                                                                                                                                |         |
| `--grepInvert`      | string  | Only run tests that do not match this regular expression                                                                                                                                       |         |
| `--headed`          | boolean | Run tests in headed browsers                                                                                                                                                                   |         |
| `--ignoreSnapshots` | boolean | Ignore screenshot and snapshot expectations                                                                                                                                                    |         |
| `--lastFailed`      | boolean | Run only the tests that failed in the last run                                                                                                                                                 |         |
| `--list`            | boolean | Collect all the tests and report them, but do not run                                                                                                                                          |         |
| `--maxFailures`     | string  | Stop after the first N failures                                                                                                                                                                |         |
| `--noDeps`          | boolean | Do not run project dependencies                                                                                                                                                                |         |
| `--output`          | string  | Folder for output artifacts                                                                                                                                                                    |         |
| `--passWithNoTests` | boolean | Makes test run succeed even if no tests were found                                                                                                                                             | `true`  |
| `--project`         | array   | Only run tests from the specified list of projects                                                                                                                                             |         |
| `--quiet`           | boolean | Suppress stdio                                                                                                                                                                                 |         |
| `--repeatEach`      | number  | Run each test N times                                                                                                                                                                          |         |
| `--reporter`        | string  | Common Reporter values to use, comma-separated, 'list', 'line', 'dot', 'json', 'junit', 'null', 'github', 'html', 'blob'. To configure reporter options, use the playwright configuration.     |         |
| `--retries`         | number  | Maximum retry count for flaky tests, zero for no retries                                                                                                                                       |         |
| `--shard`           | string  | Shard tests and execute only the selected shard, specify in the form 'current/all', 1-based, for example '3/5'                                                                                 |         |
| `--skipInstall`     | boolean | Skip running playwright install before running playwright tests. This is to ensure that playwright browsers are installed before running tests.                                                | `false` |
| `--testFiles`       | array   | Test files to run                                                                                                                                                                              |         |
| `--timeout`         | number  | Specify test timeout threshold in milliseconds, zero for unlimited                                                                                                                             |         |
| `--trace`           | string  | Force tracing mode, can be 'on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure'                                                                                                |         |
| `--ui`              | boolean | Run tests in interactive UI mode                                                                                                                                                               |         |
| `--uiHost`          | string  | Host to serve UI on; specifying this option opens UI in a browser tab                                                                                                                          |         |
| `--uiPort`          | number  | Port to serve UI on, 0 for any free port; specifying this option opens UI in a browser tab                                                                                                     |         |
| `--updateSnapshots` | boolean | Update snapshots with actual results. Snapshots will be created if missing.                                                                                                                    |         |
| `--workers`         | string  | Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker                                                                                               |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
