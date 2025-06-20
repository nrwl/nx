---
title: '@nx/detox Executors'
description: 'Complete reference for all @nx/detox executor commands'
sidebar_label: Executors
---

# @nx/detox Executors

The @nx/detox plugin provides various executors to run tasks on your detox projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build`

Run detox build options.

**Usage:**

```bash
nx run &lt;project&gt;:build [options]
```

#### Options

| Option                 | Type   | Description                                                                                                                                    | Default |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--configPath`         | string | Specify Detox config file path. If not supplied, detox searches for `.detoxrc[.js]` or `detox` section in `package.json`.                      |         |
| `--detoxConfiguration` | string | Select a device configuration from your defined configurations, if not supplied, and there's only one configuration, detox will default to it. |         |

### `test`

Run detox test options.

**Usage:**

```bash
nx run &lt;project&gt;:test [options]
```

#### Options

| Option                                | Type    | Description                                                                                                                                                                                                  | Default |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--detoxConfiguration` **[required]** | string  | Select a device configuration from your defined configurations, if not supplied, and there's only one configuration, detox will default to it.                                                               |         |
| `--appLaunchArgs`                     | number  | Custom arguments to pass (through) onto the app every time it is launched.                                                                                                                                   |         |
| `--artifactsLocation`                 | string  | Artifacts (logs, screenshots, etc) root directory.                                                                                                                                                           |         |
| `--buildTarget`                       | string  | Target which builds the application.                                                                                                                                                                         |         |
| `--captureViewHierarchy`              | string  | [iOS Only] Capture `*.uihierarchy` snapshots on view action errors and `device.captureViewHierarchy()` calls.                                                                                                |         |
| `--cleanup`                           | boolean | Shutdown simulator when test is over, useful for CI scripts, to make sure detox exists cleanly with no residue                                                                                               |         |
| `--color`                             | boolean | Colors in log output                                                                                                                                                                                         |         |
| `--configPath`                        | string  | Specify Detox config file path. If not supplied, detox searches for `.detoxrc[.js]` or `detox` section in package.json.                                                                                      |         |
| `--debugSynchronization`              | boolean | Customize how long an action/expectation can take to complete before Detox starts querying the app why it is busy. By default, the app status will be printed if the action takes more than 10s to complete. |         |
| `--deviceBootArgs`                    | string  | Custom arguments to pass (through) onto the device (emulator/simulator) binary when booted.                                                                                                                  |         |
| `--deviceLaunchArgs`                  | string  | A list of passthrough-arguments to use when (if) devices (Android emulator / iOS simulator) are launched by Detox.                                                                                           |         |
| `--deviceName`                        | string  | Override the device name specified in a configuration. Useful for running a single build configuration on multiple devices.                                                                                  |         |
| `--forceAdbInstall`                   | boolean | Due to problems with the adb install command on Android, Detox resorts to a different scheme for install APK's. Setting true will disable that and force usage of `adb install`, instead.                    |         |
| `--gpu`                               | boolean | [Android Only] Launch Emulator with the specific `-gpu [gpu mode]` parameter.                                                                                                                                |         |
| `--headless`                          | boolean | Android Only] Launch Emulator in headless mode. Useful when running on CI.                                                                                                                                   |         |
| `--inspectBrk`                        | boolean | Uses node's `--inspect-brk` flag to let users debug the jest/mocha test runner                                                                                                                               |         |
| `--jestReportSpecs`                   | boolean | [Jest Only] Whether to output logs per each running spec, in real-time. By default, disabled with multiple workers.                                                                                          |         |
| `--keepLockFile`                      | boolean | Keep the device lock file when running Detox tests.                                                                                                                                                          |         |
| `--loglevel`                          | string  | Log level: `fatal`, `error`, `warn`, `info`, `verbose`, `trace`.                                                                                                                                             |         |
| `--recordLogs`                        | string  | Save logs during each test to artifacts directory. Pass `failing` to save logs of failing tests only.                                                                                                        |         |
| `--recordPerformance`                 | string  | [iOS Only] Save Detox Instruments performance recordings of each test to artifacts directory.                                                                                                                |         |
| `--recordTimeline`                    | string  | [Jest Only] Record tests and events timeline, for visual display on the `chrome://tracing` tool.                                                                                                             |         |
| `--recordVideos`                      | string  | Save screen recordings of each test to artifacts directory. Pass `failing` to save recordings of failing tests only.                                                                                         |         |
| `--retries`                           | number  | [Jest Circus Only] Re-spawn the test runner for individual failing suite files until they pass, or `&lt;N&gt;` times at least.                                                                               |         |
| `--reuse`                             | boolean | Reuse existing installed app (do not delete + reinstall) for a faster run.                                                                                                                                   | `false` |
| `--runnerConfig`                      | string  | Test runner config file, defaults to `e2e/mocha.opts` for mocha and `e2e/config.json` for Jest.                                                                                                              |         |
| `--takeScreenshots`                   | string  | Save screenshots before and after each test to artifacts directory. Pass `failing` to save screenshots of failing tests only.                                                                                |         |
| `--useCustomLogger`                   | boolean | Use Detox' custom console-logging implementation, for logging Detox (non-device) logs. Disabling will fallback to Node.js / test-runner's implementation (e.g. Jest / Mocha).                                |         |
| `--workers`                           | number  | Specifies number of workers the test runner should spawn, requires a test runner with parallel execution support (Detox CLI currently supports Jest).                                                        |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
