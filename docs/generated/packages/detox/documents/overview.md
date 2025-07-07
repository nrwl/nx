---
title: Detox Plugin for Nx
description: Learn how to set up and use Detox for end-to-end testing of mobile applications in your Nx workspace, including environment setup and configuration options.
---

# @nx/detox

Detox is gray box end-to-end testing and automation library for mobile apps. It has a lot of great features:

- Cross Platform
- Runs on Devices
- Automatically Synchronized
- Test Runner Independent
- Debuggable

## Setting Up Detox

### Setup Environment

#### Install applesimutils (Mac only)

[applesimutils](https://github.com/wix/AppleSimulatorUtils) is a collection of utils for Apple simulators.

```sh
brew tap wix/brew
brew install applesimutils
```

#### Install Jest Globally

```sh
npm install -g jest
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/detox` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/detox` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/detox
```

This will install the correct version of `@nx/detox`.

### How @nx/detox Infers Tasks

The `@nx/detox` plugin will create a task for any project that has an ESLint configuration file present. Any of the following files will be recognized as an ESLint configuration file:

- `.detoxrc.js`
- `.detoxrc.json`
- `detox.config.js`
- `detox.config.json`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/detox Configuration

The `@nx/detox/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/detox/plugin",
      "options": {
        "buildTargetName": "build",
        "startTargetName": "start",
        "testTargetName": "test"
      }
    }
  ]
}
```

Once a Detox configuration file has been identified, the targets are created with the name you specify under `buildTargetName`, `startTargetName` or `testTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `build` and `test`.

## Using Detox

### Testing Applications

- Run `nx test-ios frontend-e2e` to build the iOS app and execute e2e tests with Detox for iOS (Mac only)
- Run `nx test-android frontend-e2e` to build the Android app and execute e2e tests with Detox for Android

You can run below commands:

- `nx build-ios frontend-e2e`: build the iOS app (Mac only)
- `nx build-android frontend-e2e`: build the Android app

### Testing against Prod Build

You can run your e2e test against a production build:

- `nx test-ios frontend-e2e --prod`: to build the iOS app and execute e2e tests with Detox for iOS with Release configuration (Mac only)
- `nx test-android frontend-e2e --prod`: to build the Android app and execute e2e tests with Detox for Android with release build type
- `nx build-ios frontend-e2e --prod`: build the iOS app using Release configuration (Mac only)
- `nx build-android frontend-e2e --prod`: build the Android app using release build type

## Configuration

### Using .detoxrc.json

If you need to fine tune your Detox setup, you can do so by modifying `.detoxrc.json` in the e2e project.

#### Change Testing Simulator/Emulator

For iOS, in terminal, run `xcrun simctl list devices available` to view a list of simulators on your Mac. To open your active simulator, `run open -a simulator`. In `frontend-e2e/.detoxrc.json`, you could change the simulator under `devices.simulator.device`.

For Android, in terminal, run `emulator -list-avds` to view a list of emulators installed. To open your emulator, run `emulator -avd <your emulator name>`. In `frontend-e2e/.detoxrc.json`, you could change the simulator under `devices.emulator.device`.

In addition, to override the device name specified in a configuration, you could use `--device-name` option: `nx test-ios <app-name-e2e> --device-name "iPhone 11"`. The `device-name` property provides you the ability to test an application run on specific device.

```shell
nx test-ios frontend-e2e --device-name "iPhone 11"
nx test-android frontend-e2e --device-name "Pixel_4a_API_30"
```
