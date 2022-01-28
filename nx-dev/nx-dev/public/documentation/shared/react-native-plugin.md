# React Native Plugin

![React Logo](/shared/react-logo.png)

The Nx Plugin for React Native contains generators for managing React Native applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Detox, and Storybook.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Adding the React Native plugin

Adding the React plugin to a workspace can be done with the following:

```bash
yarn add -D @nrwl/react-native
```

```bash
npm install -D @nrwl/react-native
```

> Note: You can create a new workspace that has React set up by doing `npx create-nx-workspace@latest --preset=react-native`

The file structure for a React application looks like:

```treeview
<workspace name>/
├── apps/
│   ├── myapp/
│   │   ├── app.json
│   │   ├── metro.config.js
│   │   ├── android/
│   │   │   ├── app/
│   │   │   ├── gradle/
│   │   │   ├── build.gradle
│   │   │   ├── gradle.properties
│   │   │   ├── gradlew
│   │   │   ├── settings.gradle
│   │   ├── ios/
│   │   │   ├── Mobile/
│   │   │   ├── Mobile.xcodeproj/
│   │   │   ├── Mobile.xcworkspace/
│   │   │   ├── Podfile
│   │   │   ├── Podfile.lock
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   └── app/
│   │   │       ├── App.tsx
│   │   │       └── App.spec.tsx
│   │   ├── .babelrc
│   │   ├── jest.config.js
│   │   ├── test-setup.ts
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json
│   │   └── tsconfig.spec.json
│   └── myapp-e2e/
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

## See Also

- [Using Detox](/detox/overview)
- [Using Jest](/jest/overview)

## Executors / Builders

- [run-ios](/react-native/run-ios) - Builds your app and starts it on iOS simulator
- [run-android](/react-native/run-android) - Builds your app and starts it on a connected Android emulator or device
- [build-android](/react-native/build-android) - Release Build for Android
- [start](/react-native/package) - Starts the server that communicates with connected devices
- [bundle](/web/package) - Builds the JavaScript bundle for offline use
- [sync-deps](/react-native/sync-deps) - Syncs dependencies to package.json (required for autolinking)
- [ensure-symlink](/react-native/ensure-symlink) - Ensure workspace node_modules is symlink under app's node_modules folder

## Generators

- [application](/react-native/application) - Create a React Native application
- [component](/react-native/component) - Create a React Native component
- [library](/react-native/library) - Create a React Native library
