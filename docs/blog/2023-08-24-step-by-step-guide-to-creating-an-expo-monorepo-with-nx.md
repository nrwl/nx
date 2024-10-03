---
title: 'Step-by-Step Guide to Creating an Expo Monorepo with Nx'
slug: 'step-by-step-guide-to-creating-an-expo-monorepo-with-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2023-08-24/1*IpM0kZdUNXoDWV4r8J5xXQ.png'
tags: [nx, tutorial]
---

This blog will show you how to create an Expo monorepo with Nx. In this example, you will be creating two Expo apps in a monorepo with `@nx/expo`: one shows random facts about cats, and the other shows random facts about dogs.

![](/blog/images/2023-08-24/1*ZObpn_5XsfYX-My6d9n4Zw.avif)
![](/blog/images/2023-08-24/1*S6bzPlLbnM_Li_0Rh7mmWw.avif)
_Left: cats, right: dogs_

As shown in the above screenshots, these two apps have the same branding and reuse all components.

This blog will go through:

- How to create a monorepo workspace with Nx
- How to share a React Native library
- How to build an Expo app
- How to submit an Expo app to the app store

Github repo: [xiongemi/nx-expo-monorepo](https://github.com/xiongemi/nx-expo-monorepo)

## Creating an Nx Workspace

To create a new Nx workspace, run the command `npx create-nx-workspace <workspace name>` in the terminal. In this example, let’s name it `nx-expo-monorepo`:

```
✔ Where would you like to create your workspace? · create-nx-monorepo
✔ Which stack do you want to use? · react
✔ What framework would you like to use? · expo
✔ Application name · cats
✔ Enable distributed caching to make your CI faster · No
```

This will create an [integrated](/deprecated/integrated-vs-package-based) repo. What is an integrated repo?

> An integrated repo contains projects that depend on each other through standard import statements. There is typically a [single version of every dependency](/concepts/decisions/dependency-management) defined at the root.  
> [/deprecated/integrated-vs-package-based](/deprecated/integrated-vs-package-based)

Now, your Nx workspace should have cats and cats-e2e under the `apps` folder and an empty libs folder:

![](/blog/images/2023-08-24/1*9yWjfR4oV5B0KFSdNgCH0g.avif)

### Existing Nx Workspace

If you already have an Nx workspace, you need to install the @nx/expo package:

```shell
\# npm
npm install @nx/expo --save-dev

\# yarn
yarn add @nx/expo --dev

\# pnpm
pnpm add @nx/expo --save-dev
```

To create an Expo app, run:

```shell
npx nx generate @nx/expo:app cats
```

Alternatively, if you use Visual Studio Code as your code editor, you can also create apps using [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console):

![](/blog/images/2023-08-24/1*WB17bHQ4p3nXJYWJ_IHGaw.avif)

## Install Tech Stacks

Here are the tech stacks this example is going to use:

- Material design library: [react-native-paper](https://callstack.github.io/react-native-paper/)

```shell
\# npm
npm install react-native-paper react-native-safe-area-context --save

\# yarn
yarn add react-native-paper react-native-safe-area-context

\# pnpm
pnpm add react-native-paper react-native-safe-area-context --save
```

- Routing: [@react-navigation/native](https://reactnavigation.org/)

```shell
\# npm
npm install react-native-paper react-native-screens @react-navigation/native-stack --save

\# yarn
yarn add react-native-paper react-native-screens @react-navigation/native-stack

\# pnpm
pnpm add react-native-paper react-native-screens @react-navigation/native-stack --save
```

## Create a Shareable UI Library

With all the required libraries installed, you need to create a sharable UI library:

```shell
npx nx generate @nx/expo:lib ui
```

Now under the `libs` folder, a `ui` folder has been created:

![](/blog/images/2023-08-24/1*evR014EchmXEWHJfJnbJRg.avif)
_ui folder_

To create a component in the `ui` library, run:

```shell
npx nx generate @nx/expo:component carousel --project=ui --export
```

You can see that a `carousel` folder has been created in the `libs/ui/src/lib` folder:

![](/blog/images/2023-08-24/1*s_zYPQv0QVg5-juNRXmedw.avif)
_carousel folder_

Next, modify this component to display the content with props passed in:

```tsx
import React from 'react';
import { Card, Title, Paragraph } from 'react-native-paper';

export interface CarouselProps {
  imageUri?: string;
  title?: string;
  content: string;
}

export function Carousel({ imageUri, title, content }: CarouselProps) {
  return (
    <Card>
      {imageUri && <Card.Cover source={{ uri: imageUri }} />}
      <Card.Content>
        {title && <Title>{title}</Title>}
        <Paragraph>{content}</Paragraph>
      </Card.Content>
    </Card>
  );
}

export default Carousel;
```

Now you can use this component in your app directly using an import:

```
import { Carousel } from '@nx-expo-monorepo/ui';
```

## Add Navigation

This project is going to use the [stack navigator](https://reactnavigation.org/docs/stack-navigator) from [@react-navigation/native](https://reactnavigation.org/). So the app needs to import from @react-navigation/stack. In `apps/cats/src/app/App.tsx`, you can change the UI to have one screen displaying a carousel with mock data:

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Carousel } from '@nx-expo-monorepo/ui';

const App = () => {
  const Stack = createNativeStackNavigator();
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Cat Facts"
          component={() => (
            <Carousel
              title="title"
              content="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec porta leo justo, id posuere urna tempor convallis. Nulla finibus, dolor sit amet facilisis pellentesque, velit nisi tempor ipsum, nec interdum libero felis a risus. Pellentesque bibendum, dolor vel varius pulvinar, tortor leo ultrices nisi, non sodales dui quam vitae nulla. Integer sed rhoncus dui. Vestibulum bibendum diam ut leo tempus, vel vulputate magna iaculis. Suspendisse tempus magna libero, sed facilisis tellus aliquet ac. Morbi at velit ornare, posuere tortor vitae, mollis erat. Donec maximus mollis luctus. Vivamus sodales sodales dui pellentesque imperdiet. Mauris a ultricies nibh. Integer sed vehicula magna."
            />
          )}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
```

Run the app with`nx start cats`, and you should be able to see the app on the simulator:

![](/blog/images/2023-08-24/1*1hFA_7uBgU2GpFofNtHBiQ.avif)
_Page on the simulator (left: iOS, right: Android)_

## Add Another App

In this example, there is already a `Cats` app. To create the `Dogs` app, run the command:

```shell
npx nx generate @nx/expo:app dogs
```

Alternatively, if you use Visual Studio Code as your code editor, you can also create apps using [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console):

![](/blog/images/2023-08-24/1*8ut9KSAOn-UBBNxHJMtVXQ.avif)

Under the apps folder, there should be `cats/`, `dogs/` and their e2es.

![](/blog/images/2023-08-24/1*juth4jstENJ4h1AvIibujA.avif)
_apps folder_

You can reuse the UI library in the Dogs app in `apps/dogs/src/app/App.tsx` with the below code:

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Carousel } from '@nx-expo-monorepo/ui';

const App = () => {
  const Stack = createNativeStackNavigator();
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Dog Facts"
          component={() => (
            <Carousel
              title="title"
              content="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec porta leo justo, id posuere urna tempor convallis. Nulla finibus, dolor sit amet facilisis pellentesque, velit nisi tempor ipsum, nec interdum libero felis a risus. Pellentesque bibendum, dolor vel varius pulvinar, tortor leo ultrices nisi, non sodales dui quam vitae nulla. Integer sed rhoncus dui. Vestibulum bibendum diam ut leo tempus, vel vulputate magna iaculis. Suspendisse tempus magna libero, sed facilisis tellus aliquet ac. Morbi at velit ornare, posuere tortor vitae, mollis erat. Donec maximus mollis luctus. Vivamus sodales sodales dui pellentesque imperdiet. Mauris a ultricies nibh. Integer sed vehicula magna."
            />
          )}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
```

## Build Expo Apps

[EAS Build](https://docs.expo.dev/build/introduction/) is a hosted service for building app binaries for your Expo and React Native projects. To set up EAS locally:

### 1. Install EAS CLI

EAS CLI is the command-line app to interact with EAS services in the terminal. To install it, run the command:

```
npm install -g eas-cli
```

### 2. Login To EAS

If you are not logged in, run the command:

```
eas login
```

### 3. Build the Apps

After the EAS setup, you can build apps by running the command:

```shell
npx nx build cats
npx nx build dogs
```

There are different options you can specify with the build command. For example, you can specify the platform you want to build:

```shell
npx nx build cats --platform=all
npx nx build cats --platform=android
npx nx build cats --platform=ios
```

Alternatively, if you want to create a build to run on a simulator/emulator, you can run:

```shell
npx nx build cats --profile=preview
```

You can view your build status at [https://expo.dev/](https://expo.dev/):

![](/blog/images/2023-08-24/1*pQxTgypzL10_SmI71jaWVQ.avif)

If you want to create a build locally using your own infrastructure:

```shell
npx nx build cats --local
```

Here is the complete list of flags for the build command: [/nx-api/expo/executors/build](/nx-api/expo/executors/build).

## Submit to the App Store

Before you submit, you need to have paid developer accounts for iOS and Android.

- iOS: You need to create an Apple Developer account on the Apple [Developer Portal](https://developer.apple.com/account/).
- Android: You need to create a Google Play Developer account on the [Google Play Console sign-up page](https://play.google.com/apps/publish/signup/). You also need to manually create an app on [Google Play Console](https://play.google.com/apps/publish/) and upload your app for the first time.

### 1\. Run the production build

To submit to the app store, you can build the app by running:

```shell
npx nx build cats --profile=production
```

### 2\. Submit the Build

You can manually upload the build bundle binary to the app store, or you can submit it through EAS.

First, in `app.json` under the project `apps/cats/app.json`, you need to make sure`ios.bundleIdentifier` and `android.package` keys are correct:

![](/blog/images/2023-08-24/1*j9TAZZgqplZCcjD4hiWNpg.avif)
_app.json_

To submit your app to the app stores, run:

```shell
npx nx submit cats
```

Nx will prompt you to choose the platform to which you want to submit:

![](/blog/images/2023-08-24/1*PcBvY1SJCHZyOnJI1hskAQ.avif)

Or you can also specify the platform directly in the initial command:

```shell
npx nx submit cats --platform=all
npx nx submit cats --platform=android
npx nx submit cats --platform=ios
```

It will then ask you to choose which binary to submit from one of the following options:

- The latest finished Android build for the project on EAS servers.
- Specific build ID. It can be found on the [builds dashboard](https://expo.dev/builds).
- Path to an .apk or .aab or .ipa archive on your local filesystem.
- URL to the app archive.

Alternatively, you can submit your app on the [expo.dev](https://expo.dev/) site. Go to your build, under options, choose “Submit to an app store”:

![](/blog/images/2023-08-24/1*yQlEmKOy3TXdWPCk9ILiZA.avif)

## Summary

In this article, you have learned how to:

- Create multiple apps in a monorepo using @nx/expo
- Create a shared library
- Build your app using EAS
- Submit your app to the App Store

With Nx, it is easy to create and scale up an Expo app. Even though this app is currently a simple 2-page app, you can easily scale it up with more libraries and components. Furthermore, you can also reuse those libraries in the future if you decide to add another app to the repo.

## Learn more

- [Unit Testing Expo Apps With Jest](/blog/unit-testing-expo-apps-with-jest)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](https://nx.app/)
