---
title: '@nrwl/react-native:run-android executor'
description: 'Runs Android application.'
---

# @nrwl/react-native:run-android

Runs Android application.

Options can be configured in `workspace.json` when defining the executor, or when invoking it. Read more about how to configure targets and executors here: https://nx.dev/core-concepts/configuration#targets.

## Options

### appId

Type: `string`

Specify an applicationId to launch after build. If not specified, 'package' from AndroidManifest.xml will be used.

### appIdSuffix

Type: `string`

Specify an applicationIdSuffix to launch after build.

### deviceId

Type: `string`

Builds your app and starts it on a specific device/simulator with the given device id (listed by running "adb devices" on the command line).

### jetifier

Default: `true`

Type: `boolean`

Run jetifier – the AndroidX transition tool. By default it runs before Gradle to ease working with libraries that don't support AndroidX yet.

### mainActivity

Default: `MainActivity`

Type: `string`

Name of the activity to start.

### packager

Default: `true`

Type: `boolean`

Starts the packager server

### port

Default: `8081`

Type: `number`

The port where the packager server is listening on.

### resetCache

Default: `false`

Type: `boolean`

Resets metro cache

### sync

Default: `true`

Type: `boolean`

Syncs npm dependencies to package.json (for React Native autolink).

### tasks

Type: `string`

Run custom gradle tasks. If this argument is provided, then --variant option is ignored. Example: yarn react-native run-android --tasks clean,installDebug.

### terminal

Type: `string`

Launches the Metro Bundler in a new window using the specified terminal path.

### variant

Default: `debug`

Type: `string`

Specify your app's build variant (e.g. debug, release).
