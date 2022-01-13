---
title: '@nrwl/detox:test executor'
description: 'Initiating your detox test suite.'
---

# @nrwl/detox:test

Initiating your detox test suite.

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/configuration/projectjson#targets.

## Options

### appLaunchArgs

Type: `number`

Custom arguments to pass (through) onto the app every time it is launched.

### artifactsLocation

Alias(es): a

Type: `string`

Artifacts (logs, screenshots, etc) root directory.

### captureViewHierarchy

Type: `string`

[iOS Only] Capture \*.uihierarchy snapshots on view action errors and device.captureViewHierarchy() calls.

### cleanup

Type: `boolean`

Shutdown simulator when test is over, useful for CI scripts, to make sure detox exists cleanly with no residue

### configPath

Alias(es): cp

Type: `string`

Specify Detox config file path. If not supplied, detox searches for .detoxrc[.js] or "detox" section in package.json

### debugSynchronization

Alias(es): d

Type: `string`

Customize how long an action/expectation can take to complete before Detox starts querying the app why it is busy. By default, the app status will be printed if the action takes more than 10s to complete.

### detoxConfiguration

Alias(es): C

Type: `string`

Select a device configuration from your defined configurations, if not supplied, and there's only one configuration, detox will default to it

### deviceLaunchArgs

Type: `string`

A list of passthrough-arguments to use when (if) devices (Android emulator / iOS simulator) are launched by Detox.

### deviceName

Alias(es): n

Type: `string`

Override the device name specified in a configuration. Useful for running a single build configuration on multiple devices.

### forceAdbInstall

Type: `boolean`

Due to problems with the adb install command on Android, Detox resorts to a different scheme for install APK's. Setting true will disable that and force usage of adb install, instead.

### gpu

Type: `boolean`

[Android Only] Launch Emulator with the specific -gpu [gpu mode] parameter.

### headless

Type: `boolean`

Android Only] Launch Emulator in headless mode. Useful when running on CI.

### inspectBrk

Type: `boolean`

Uses node's --inspect-brk flag to let users debug the jest/mocha test runner

### jestReportSpecs

Type: `boolean`

[Jest Only] Whether to output logs per each running spec, in real-time. By default, disabled with multiple workers.

### loglevel

Alias(es): l

Type: `string`

Log level: fatal, error, warn, info, verbose, trace

### noColor

Type: `boolean`

Disable colors in log output

### recordLogs

Type: `string`

Save logs during each test to artifacts directory. Pass "failing" to save logs of failing tests only.

### recordPerformance

Type: `string`

[iOS Only] Save Detox Instruments performance recordings of each test to artifacts directory.

### recordTimeline

Type: `string`

[Jest Only] Record tests and events timeline, for visual display on the chrome://tracing tool.

### recordVideos

Type: `string`

Save screen recordings of each test to artifacts directory. Pass "failing" to save recordings of failing tests only.

### retries

Type: `number`

[Jest Circus Only] Re-spawn the test runner for individual failing suite files until they pass, or <N> times at least.

### reuse

Type: `boolean`

Reuse existing installed app (do not delete + reinstall) for a faster run.

### runnerConfig

Alias(es): o

Type: `string`

Test runner config file, defaults to 'e2e/mocha.opts' for mocha and 'e2e/config.json' for jest.

### takeScreenshots

Type: `string`

Save screenshots before and after each test to artifacts directory. Pass "failing" to save screenshots of failing tests only.

### useCustomLogger

Type: `boolean`

Use Detox' custom console-logging implementation, for logging Detox (non-device) logs. Disabling will fallback to node.js / test-runner's implementation (e.g. Jest / Mocha).

### workers

Type: `number`

Specifies number of workers the test runner should spawn, requires a test runner with parallel execution support (Detox CLI currently supports Jest).
