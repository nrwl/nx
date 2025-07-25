---
title: Overview of the Nx React Native Plugin
description: The Nx Plugin for React Native contains generators for managing React Native applications and libraries within an Nx workspace. This page also explains how to configure React Native on your Nx workspace.
---

# @nx/react-native

React Native brings React's declarative UI framework to iOS and Android. With React Native, you use native UI controls and have full access to the native platform.

The Nx Plugin for React Native contains generators for managing React Native applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Detox, and Storybook.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Setting Up React Native

### Create a New Workspace

To create a new workspace with React Native, run the following command:

```shell
npx create-nx-workspace@latest your-workspace-name --preset=react-native --appName=your-app-name
```

{% callout type="note" title="Don't know what you need?" %}
You can also run the command without arguments to go through the interactive prompts.
{% /callout %}

```shell
npx create-nx-workspace your-workspace-name
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/react-native` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/react-native` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/react-native
```

This will install the correct version of `@nx/react-native`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/react-native` package with your package manager.

```shell
npm add -D @nx/react-native
```

{% /tab %}
{% /tabs %}

### How @nx/react-native Infers Tasks

{% callout type="note" title="Inferred Tasks" %}
Since Nx 18, Nx plugins can infer tasks for your projects based on the configuration of different tools. You can read more about it at the [Inferred Tasks concept page](/concepts/inferred-tasks).
{% /callout %}

The `@nx/react-native` plugin will create a task for any project that has an app configuration file present. Any of the following files will be recognized as an app configuration file:

- `app.config.js`
- `app.json`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/react-native Configuration

The `@nx/react-native/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/react-native/plugin",
      "options": {
        "startTargetName": "start",
        "podInstallTargetName": "pod-install",
        "bundleTargetName": "bundle",
        "runIosTargetName": "run-ios",
        "runAndroidTargetName": "run-android",
        "buildIosTargetName": "build-ios",
        "buildAndroidTargetName": "build-android"
      }
    }
  ]
}
```

Once a React Native configuration file has been identified, the targets are created with the name you specify under `startTargetName`, `podInstallTargetName`, `bundleTargetName`, `runIosTargetName`, `runAndroidTargetname`, `buildIosTargetName` or `buildAndroidTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `start`, `pod-install`, `bundle`, `run-ios`, `run-android`, `build-ios` and `build-android`.

### Generating Applications

To create additional React Native apps run:

```shell
nx g @nx/react-native:app apps/<your-app-name>
```

### Generating Libraries

To generate a new library run:

```shell
nx g @nx/react-native:lib libs/<your-lib-name>
```

### Generating Components

To generate a new component inside library run:

```shell
nx g @nx/react-native:component <component-path> --export
```

Replace `<component-directory>` with the directory where you want to place the component. It must be a path to a directory relative to the workspace root and located inside the library project root.

### Upgrade React Native

The Nx CLI provides the [`migrate` command](/features/automate-updating-dependencies) to help you stay up to date with the latest version of Nx.

#### Use upgrade command

To upgrade native iOS and Android code:

```shell
nx upgrade <your-app-name>
```

#### Upgrade Manually

You can also upgrade React Native iOS and Android code using the [rn-diff-purge](https://react-native-community.github.io/upgrade-helper/) project.

### Start Metro Server

To start the server that communicates with connected devices:

```shell
nx start <your-app-name>
```

### Run iOS

To build your app and start it on iOS simulator or device:

```shell
nx run-ios <your-app-name>
```

### Run Android

To build your app and start it on a connected Android emulator or device:

```shell
nx run-android <your-app-name>
```

### Build iOS

To build an iOS app:

```shell
nx build-ios <your-app-name>
```

The build artifacts will be located under `<your app folder>/ios/build`.

You can specify the build folder by setting the `buildFolder` option:

```shell
nx build-ios <your-app-name> --buildFolder="./build"
```

### Build Android

To build an Android app, run:

```shell
nx build-android <your app name>
```

The build artifacts will be located under `<your app folder>/android/app/build`.

## More Documentation

- [Using Detox](/technologies/test-tools/detox/introduction)
- [Using Jest](/technologies/test-tools/jest/introduction)
