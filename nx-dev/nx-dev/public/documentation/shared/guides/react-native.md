# React Native with Nx

![](/shared/react-logo.png)

Nx provides a holistic dev experience powered by an advanced CLI and editor plugins. It provides rich support for common tools like [Detox](/{{version}}/{{framework}}/detox/overview), Storybook, Jest, and more.

In this guide we will show you how to develop [React Native](https://reactnative.dev/) applications with Nx.

## Creating Nx Workspace

The easiest way to create your workspace is via `npx`.

```bash
npx create-nx-workspace happynrwl \
--preset=react-native \
--appName=mobile
```

**Note:** You can also run the command without arguments to go through the interactive prompts.

```bash
npx create-nx-workspace happynrwl
```

Once the command completes, the workspace will look as follows:

```treeview
happynrwl/
├── apps
│   ├── mobile
│   │   ├── app.json
│   │   ├── metro.config.js
│   │   ├── android
│   │   │   ├── app
│   │   │   ├── gradle
│   │   │   ├── build.gradle
│   │   │   ├── gradle.properties
│   │   │   ├── gradlew
│   │   │   ├── settings.gradle
│   │   ├── ios
│   │   │   ├── Mobile
│   │   │   ├── Mobile.xcodeproj
│   │   │   ├── Mobile.xcworkspace
│   │   │   ├── Prodfile
│   │   │   ├── Prodfile.lock
│   │   ├── src
│   │   │   ├── main.tsx
│   │   │   └── app
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
│   └── mobile-e2e
│       ├── .detoxrc.json
│       ├── src
│       │   └── app.spec.ts
│       ├── .babelrc
│       ├── jest.config.json
│       ├── project.json
│       ├── tsconfig.e2e.json
│       └── tsconfig.json
├── libs
├── tools
├── jest.config.js
├── jest.preset.js
├── nx.json
├── package-lock.json
├── package.json
├── tsconfig.base.json
└── workspace.json
```

Run `npx nx run-android mobile` to run the applicatoin in development mode on Android simulator/device. Run `npx nx run-ios mobile` to run the applicatoin in developement mode on iOS simulator/device.

Try out other commands as well.

- `nx lint mobile` to lint the application
- `nx test mobile` to run unit test on the application using Jest
- `nx serve mobile` to serve the application Javascript bundler that communicates with connected devices. This will start the bundler at http://localhost:8081.
- `nx sync-deps mobile` to sync app dependencies to its `package.json`.

### Release build

**Android:**

```sh
npx nx build-android mobile
```

**iOS:** (Mac only)

No CLI support yet. Run in the Xcode project. See: https://reactnative.dev/docs/running-on-device

### E2E

**Android:**

```sh
npx nx e2e-android mobile-e2e
```

**iOS:** (Mac only)

```sh
npx nx e2e-ios mobile-e2e
```

When using React Native in Nx, you get the out-of-the-box support for TypeScript, Detox, and Jest. No need to configure anything: watch mode, source maps, and typings just work.

### Adding React Native to an Existing Workspace

For existing Nx workspaces, install the `@nrwl/react-native` package to add React Native capabilities to it.

```bash
npm install @nrwl/react-native --save-dev

# Or with yarn
yarn add @nrwl/react-native --dev
```

## Generating an Application

To create additional React Native apps run:

```bash
npx nx g @nrwl/react-native:app
```

## Generating a Library

Nx allows you to create libraries with just one command. Some reasons you might want to create a library include:

- Share code between applications
- Publish a package to be used outside the monorepo
- Better visualize the architecture using `npx nx dep-graph`

For more information on Nx libraries, see our documentation on [Creating Libraries](/{{version}}/{{framework}}/structure/creating-libraries)
and [Library Types](/{{version}}/{{framework}}/structure/library-types).

To generate a new library run:

```bash
npx nx g @nrwl/react-native:lib shared-ui-layout
```

And you will see the following:

```treeview
happynrwl/
├── apps
│   └── mobile
│   └── mobile-e2e
├── libs
│   └── shared-ui-layout
│       ├── src
│       │   └── index.ts
│       ├── .babelrc
│       ├── jest.config.js
│       ├── project.json
│       ├── README.md
│       ├── test-setup.ts
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       └── tsconfig.spec.json
├── tools
├── jest.config.js
├── jest.preset.js
├── nx.json
├── package-lock.json
├── package.json
├── tsconfig.base.json
└── workspace.json
```

Run:

- `npx nx test shared-ui-layout` to test the library
- `npx nx lint shared-ui-layout` to lint the library

To generate a new comopnent inside `shared-ui-layout` run:

```bash
npx nx g @nrwl/react-native:component layout --project=shared-ui-layout --export
```

And you will see the following updated for `shared-ui-layout`:

```treeview
happynrwl/
└── libs
    └── shared-ui-layout
        └── src
            ├── index.ts
            └── lib
                 └── layout
                     ├── layout.tsx
                     └── layout.spec.tsx
```

### Using Nx Library in your Application

You can import the `shared-ui-layout` library in your application as follows.

```typescript jsx
// apps/mobile/src/app/App.tsx
import React from 'react';
import { SafeAreaView } from 'react-native';

import { Layout } from '@happynrwl/shared-ui-layout';

const App = () => {
  return (
    <SafeAreaView>
      <Layout />
    </SafeAreaView>
  );
};

export default App;
```

That's it! There is no need to build the library prior to using it. When you update your library, the React Native application will automatically pick up the changes.

### Publishable libraries

For libraries intended to be built and published to a registry (e.g. npm) you can use the `--publishable` and `--importPath` options.

```bash
npx nx g @nrwl/react-native:lib shared-ui-layout --publishable --importPath=@happynrwl/ui-components
npx nx g @nrwl/react-native:component layout --project=shared-ui-layout --export
```

Run `npx nx build shared-ui-layout` to build the library. It will generate the following:

```treeview
dist/libs/shared-ui-layout/
├── README.md
├── index.d.ts
├── lib
│   └── layout
│       └── layout.d.ts
├── package.json
├── shared-ui-layout.esm.css
├── shared-ui-layout.esm.js
├── shared-ui-layout.umd.css
└── shared-ui-layout.umd.js
```

This dist folder is ready to be published to a registry.

## Code Sharing

Without Nx, creating a new shared library can take from several hours or even weeks: a new repo needs to be provisioned, CI needs to be set up, etc.. In an Nx Workspace, it only takes minutes.

You can share React Native components between multiple React Native applications. You can also share business logic code between React Native mobile applications and plain React webapplications. You can even share code between the backend and the frontend. All can be done without any unnecessary ceremony.

## Resources

Here are other resources that you may find useful to learn more about React Native and Nx.

- **Blog post:** [Introducing React Native Support for Nx](https://blog.nrwl.io/introducing-react-native-support-for-nx-48d335e90c89) by Jack Hsu
- **Blog post:** [Step by Step Guide on Creating a Monorepo for React Native Apps using Nx](https://blog.nrwl.io/step-by-step-guide-on-creating-a-monorepo-for-react-native-apps-using-nx-704753b6c70e) by Eimly Xiong
