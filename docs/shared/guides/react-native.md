# React Native with Nx

Nx provides a holistic dev experience powered by an advanced CLI and editor plugins. It provides rich support for common tools like [Detox](/packages/detox), Storybook, Jest, and more.

In this guide we will show you how to develop [React Native](https://reactnative.dev/) applications with Nx.

## Creating Nx Workspace

The easiest way to create your workspace is via `npx`.

```shell
npx create-nx-workspace happynrwl \
--preset=react-native \
--appName=mobile
```

{% callout type="note" title="Don't know what you need?" %}
You can also run the command without arguments to go through the interactive prompts.
{% /callout %}

```shell
npx create-nx-workspace happynrwl
```

Once the command completes, the workspace will look as follows:

```text
happynrwl/
├── apps/
│   ├── mobile/
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
│   │   ├── jest.config.ts
│   │   ├── test-setup.ts
│   │   ├── package.json
│   │   ├── project.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json
│   │   └── tsconfig.spec.json
│   └── mobile-e2e/
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
├── jest.config.ts
├── jest.preset.js
├── nx.json
├── package-lock.json
├── package.json
└── tsconfig.base.json
```

To run the application in development mode:

```shell
npx nx start mobile
```

On Android simulator/device:

```shell
npx nx run-android mobile
```

iOS simulator/device:

```shell
npx nx run-ios mobile
```

Try out other commands as well.

- `nx lint mobile` to lint the application
- `nx test mobile` to run unit test on the application using Jest
- `nx sync-deps mobile` to sync app dependencies to its `package.json`.

### Release build

**Android:**

```shell
npx nx build-android mobile
```

**iOS:** (Mac only)

```shell
npx nx build-ios mobile
```

### E2E

**Android:**

```shell
npx nx test-android mobile-e2e
```

**iOS:** (Mac only)

```shell
npx nx test-ios mobile-e2e
```

When using React Native in Nx, you get the out-of-the-box support for TypeScript, Detox, and Jest.

### Adding React Native to an Existing Workspace

For existing Nx workspaces, install the `@nx/react-native` package to add React Native capabilities to it.

```shell
npm install @nx/react-native --save-dev

# Or with yarn
yarn add @nx/react-native --dev
```

## Generating an Application

To create additional React Native apps run:

```shell
npx nx g @nx/react-native:app
```

## Generating a Library

Nx allows you to create libraries with just one command. Some reasons you might want to create a library include:

- Share code between applications
- Publish a package to be used outside the monorepo
- Better visualize the architecture using `npx nx graph`

For more information on Nx libraries, see our documentation on [Creating Libraries](/more-concepts/creating-libraries)
and [Library Types](/more-concepts/library-types).

To generate a new library run:

```shell
npx nx g @nx/react-native:lib shared-ui-layout
```

And you will see the following:

```text
happynrwl/
├── apps/
│   └── mobile/
│   └── mobile-e2e/
├── libs/
│   └── shared-ui-layout/
│       ├── src/
│       │   └── index.ts
│       ├── .babelrc
│       ├── jest.config.js
│       ├── project.json
│       ├── README.md
│       ├── test-setup.ts
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       └── tsconfig.spec.json
├── tools/
├── babel.config.json
├── jest.config.js
├── jest.preset.js
├── nx.json
├── package-lock.json
├── package.json
└── tsconfig.base.json
```

Run:

- `npx nx test shared-ui-layout` to test the library
- `npx nx lint shared-ui-layout` to lint the library

To generate a new component inside `shared-ui-layout` run:

```shell
npx nx g @nx/react-native:component layout --project=shared-ui-layout --export
```

And you will see the following updated for `shared-ui-layout`:

```treeview
happynrwl/
└── libs/
    └── shared-ui-layout/
        └── src/
            ├── index.ts
            └── lib/
                 └── layout/
                     ├── layout.tsx
                     └── layout.spec.tsx
```

### Using Nx Library in your Application

You can import the `shared-ui-layout` library in your application as follows.

```typescript jsx {% fileName="apps/mobile/src/app/App.tsx" %}
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

```shell
npx nx g @nx/react-native:lib shared-ui-layout --publishable --importPath=@happynrwl/ui-components
npx nx g @nx/react-native:component layout --project=shared-ui-layout --export
```

Run `npx nx build shared-ui-layout` to build the library. It will generate the following:

```text
dist/libs/shared-ui-layout/
├── README.md
├── index.d.ts
├── lib/
│   └── layout/
│       └── layout.d.ts
└── package.json
```

This dist folder is ready to be published to a registry.

## Code Sharing

Without Nx, creating a new shared library can take from several hours to even weeks: a new repo needs to be provisioned, CI needs to be set up, etc... In an Nx Workspace, it only takes minutes.

You can share React Native components between multiple React Native applications, share business logic code between React Native mobile applications and plain React web applications. You can even share code between the backend and the frontend. All of these can be done without any unnecessary ceremony.
