<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-react.png" width="600" alt="Nx - Smart, Fast and Extensible Build System"></p>

{{links}}

<hr>

# React Native Plugin for Nx

{{what-is-nx}}

{{getting-started}}

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Getting started](#getting-started)
  - [Create a new Nx workspace:](#create-a-new-nx-workspace)
  - [Install React Native plugin](#install-react-native-plugin)
  - [Create an app](#create-an-app)
  - [Start the JavaScript bundler](#start-the-javascript-bundler)
  - [Run on devices](#run-on-devices)
  - [Release build](#release-build)
  - [Test/lint the app](#testlint-the-app)
  - [E2e test the app](#e2e-test-the-app)
    - [Setup](#setup)
      - [Install applesimutils (Mac only)](#install-applesimutils-mac-only)
      - [Install Jest Globally](#install-jest-globally)
    - [Commands](#commands)
    - [Manually Add E2E Folder](#manually-add-e2e-folder)
    - [Change Testing Simulator/Emulator](#change-testing-simulatoremulator)
- [Using components from React library](#using-components-from-react-library)
- [CLI Commands and Options](#cli-commands-and-options)
  - [`start`](#start)
    - [`--port [number]`](#--port-number)
  - [`run-ios`](#run-ios)
    - [`--port [number]`](#--port-number-1)
    - [`--install`](#--install)
    - [`--sync`](#--sync)
  - [`run-android`](#run-android)
    - [`--port [number]`](#--port-number-2)
    - [`--sync`](#--sync-1)
  - [`sync-deps`](#sync-deps)
    - [`--include [string]`](#--include-string)
- [Learn more](#learn-more)
- [Contributing](#contributing)
- [Debugging](#debugging)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Getting started

### Create a new Nx workspace:

```sh
npx create-nx-workspace --cli=nx --preset=empty
```

### Install React Native plugin

```sh
# Using npm
npm install --save-dev @nrwl/react-native

# Using yarn
yarn add -D @nrwl/react-native
```

### Create an app

```sh
npx nx g @nrwl/react-native:app <app-name>
```

When using Nx, you can create multiple applications and themes in the same workspace. If you don't want to prefix your commands with npx, install `@nrwl/cli` globally.

### Start the JavaScript bundler

```sh
npx nx start <app-name>
```

This will start the bundler at `http://localhost:8081`.

### Run on devices

Make sure the bundler server is running.

**Android:**

```sh
npx nx run-android <app-name>
```

**iOS:** (Mac only)

```sh
npx nx run-ios <app-name> --install
```

Note: The `--install` flag installs Xcode dependencies before building the iOS app. This option keeps dependencies up to date.

### Release build

**Android:**

```sh
npx nx build-android <app-name>
```

**iOS:** (Mac only)

No CLI support yet. Run in the Xcode project. See: https://reactnative.dev/docs/running-on-device

### Test/lint the app

```sh
npx nx test <app-name>
npx nx lint <app-name>
```

## Using components from React library

You can use a component from React library generated using Nx package for React. Once you run:

```sh
npx nx g @nrwl/react-native:lib ui-button
```

This will generate the `UiButton` component, which you can use in your app.

```jsx
import { UiButton } from '@myorg/ui-button';
```

## CLI Commands and Options

Usage:

```sh
npx nx [command] [app] [...options]
```

### `start`

Starts the JS bundler that communicates with connected devices.

#### `--port [number]`

The port to listen on.

### `run-ios`

Builds your app and starts it on iOS simulator.

#### `--port [number]`

The port of the JS bundler.

#### `--install`

Install dependencies for the Xcode project before building iOS app.

#### `--sync`

Sync app dependencies to its `package.json`. On by default, use `--no-sync` to turn it off.

### `run-android`

Builds your app and starts it on iOS simulator.

#### `--port [number]`

The port of the JS bundler.

#### `--sync`

Sync app dependencies to its `package.json`. On by default, use `--no-sync` to turn it off.

### `sync-deps`

Sync app dependencies to its `package.json`.

#### `--include [string]`

A comma-separate list of additional packages to include.

e.g. `nx sync-deps [app] --include react-native-gesture,react-native-safe-area-context`

## Learn more

Visit the [Nx Documentation](https://nx.dev) to learn more.
