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

For existing Nx workspaces, install the `@nrwl/react-native` package to add React Native capabilities to it.

```shell
npm install @nrwl/react-native --save-dev

# Or with yarn
yarn add @nrwl/react-native --dev
```

### Generating Applications

To create additional React Native apps run:

```shell
nx g @nrwl/react-native:app your-app-name
```

### Generating Libraries

To generate a new library run:

```shell
npx nx g @nrwl/react-native:lib your-lib-name
```

### Generating Components

To generate a new component inside library run:

```shell
npx nx g @nrwl/react-native:component your-component-name --project=your-lib-name --export
```

Replace `your-lib-name` with the app's name as defined in your `tsconfig.base.json` file or the `name` property of your `package.json`

## Using React Native

- [run-ios](/packages/react-native/executors/run-ios) - Builds your app and starts it on iOS simulator or device
- [run-android](/packages/react-native/executors/run-android) - Builds your app and starts it on a connected Android emulator or device
- [build-android](/packages/react-native/executors/build-android) - Release Build for Android
- [start](/packages/react-native/executors/start) - Starts the server that communicates with connected devices
- [bundle](/packages/react-native/executors/bundle) - Builds the JavaScript bundle for offline use
- [sync-deps](/packages/react-native/executors/sync-deps) - Syncs dependencies to package.json (required for autolinking)
- [ensure-symlink](/packages/react-native/executors/ensure-symlink) - Ensure workspace node_modules is symlink under app's node_modules folder

## More Documentation

- [Using Detox](/packages/detox)
- [Using Jest](/packages/jest)
