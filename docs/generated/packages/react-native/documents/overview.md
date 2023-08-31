React Native brings React's declarative UI framework to iOS and Android. With React Native, you use native UI controls and have full access to the native platform.

The Nx Plugin for React Native contains generators for managing React Native applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Detox, and Storybook.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Setting Up React Native

### Create a New Workspace

The easiest way to create your workspace is via `npx`.

```shell
npx create-nx-workspace your-workspace-name \
--preset=react-native \
--appName=your-app-name
```

{% callout type="note" title="Don't know what you need?" %}
You can also run the command without arguments to go through the interactive prompts.
{% /callout %}

```shell
npx create-nx-workspace your-workspace-name
```

### Adding React Native to an Existing Workspace

For existing Nx workspaces, install the `@nx/react-native` package to add React Native capabilities to it.

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nx/react-native
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/react-native
```

{% /tab %}
{% /tabs %}

### Generating Applications

To create additional React Native apps run:

```shell
nx g @nx/react-native:app <your-app-name>
```

### Generating Libraries

To generate a new library run:

```shell
nx g @nx/react-native:lib your-lib-name
```

### Generating Components

To generate a new component inside library run:

```shell
nx g @nx/react-native:component your-component-name --project=your-lib-name --export
```

Replace `your-lib-name` with the app's name as defined in your `tsconfig.base.json` file or the `name` property of your `package.json`

### Upgrade React Native

The Nx CLI provides the [`migrate` command](/core-features/automate-updating-dependencies) to help you stay up to date with the latest version of Nx.

#### Use upgrade-native Generator

To upgrade native iOS and Android code to latest, you can use the [upgrade-native](/packages/react-native/generators/upgrade-native) generator:

```shell
nx generate @nx/react-native:upgrade-native <your-app-name>
```

This is a command that will replace the iOS and Android native code folder entirely.

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
nx build ios <your-app-name> --buildFolder="./build"
```

### Build Android

To build an Android app, run:

```shell
nx build-android <your app name>
```

The build artifacts will be located under `<your app folder>/android/app/build`.

## More Documentation

- [Using Detox](/packages/detox)
- [Using Jest](/packages/jest)
