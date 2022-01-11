# Detox Plugin

![Detox logo](/shared/detox-logo.png)

Detox is gray box end-to-end testing and automation library for mobile apps. It has a lot of great features:

- Cross Platform
- Runs on Devices
- Automatically Synchronized

## How to Use Detox

### Setup

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

### Generating Applications

By default, when creating a mobile application, Nx will use Detox to create the e2e tests project.

```bash
nx g @nrwl/react-native:app frontend
```

```treeview
<workspace name>/
├── apps/
│   ├── frontend/
│   └── frontend-e2e/
│       ├── .detoxrc.json
│       ├── src/
│       │   └── app.spec.ts
│       ├── .babelrc
│       ├── jest.config.json
│       ├── project.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── libs/
├── tools/
├── babel.config.json
├── jest.config.js
├── jest.preset.js
├── nx.json
├── package.json
├── tsconfig.base.json
└── workspace.json
```

### Creating a Detox E2E project for an existing project

You can create a new Detox E2E project for an existing mobile project.

If the `@nrwl/detox` package is not installed, install the version that matches your `@nrwl/workspace` version.

```sh
# yarn
yarn add --dev @nrwl/detox
```

```sh
# npm
npm install --save-dev @nrwl/detox
```

Next, generate an E2E project based on an existing project.

```sh
nx g @nrwl/detox:app your-app-name-e2e --project=your-app-name
```

Replace `your-app-name` with the app's name as defined in your `workspace.json` file.

In addition, you need to follow [instructions at Detox](https://github.com/wix/Detox/blob/master/docs/Introduction.Android.md) to do manual setup for Android files.

### Testing Applications

- Run `nx e2e-ios frontend-e2e` to build the iOS app and execute e2e tests with Detox for iOS (Mac only)
- Run `nx e2e-android frontend-e2e` to build the Android app and execute e2e tests with Detox for Android

You can also run below commands:

- `nx build-ios frontend-e2e`: build the iOS app (Mac only)
- `nx test-ios frontend-e2e`: run e2e tests on the built iOS app (Mac only)
- `nx build-android frontend-e2e`: build the Android app
- `nx test-android frontend-e2e`: run e2e tests on the built Android app

`e2e-ios` is a shorthand command for running `build-ios` and `test-ios` sequentailly.
`android-ios` is a shorthand command for running `build-android` and `test-android` sequentailly.

### Testing against Prod Build

You can run your e2e test against a production build:

- `nx e2e-ios frontend-e2e --prod` for iOS
- `nx e2e-android frontend-e2e --prod` for Android

- `nx build-ios frontend-e2e --prod`: build the iOS app using Release configuration
- `nx test-ios frontend-e2e --prod`: run e2e tests on the built iOS app with Release configuration (Mac only)
- `nx build-android frontend-e2e --prod`: build the Android app using release build type
- `nx test-android frontend-e2e`: run e2e tests on the built Android app with release build type

### Using .detoxrc.json

If you need to fine tune your Detox setup, you can do so by modifying `.detoxrc.json` in the e2e project.

#### Change Testing Simulator/Emulator

For iOS, in terminal, run `xcrun simctl list` to view a list of simulators on your Mac. To open your active simulator, `run open -a simulator`. In `frontend-e2e/.detoxrc.json`, you could change the simulator under `devices.simulator.device`.

For Android, in terminal, run `emulator -list-avds` to view a list of emulators installed. To open your emulator, run `emulator -avd <your emulator name>`. In `frontend-e2e/.detoxrc.json`, you could change the simulator under `devices.emulator.device`.

In additon, to override the device name specified in a configuration, you could use `--device-name` option: `nx test-ios <app-name-e2e> --device-name "iPhone 11"`. The `device-name` property provides you the ability to test an application run on specific device.

```bash
nx e2e-ios frontend-e2e --device-name "iPhone 11"
nx e2e-android frontend-e2e --device-name "Pixel_4a_API_30"
nx test-ios frontend-e2e --device-name "iPhone 11"
nx test-android frontend-e2e --device-name "Pixel_4a_API_30"
```
