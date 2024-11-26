---
title: 'Introducing Expo Support for Nx'
slug: 'introducing-expo-support-for-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-03-23/1*yYc8g4ifk9RApSjAhQysag.png'
tags: [nx, release]
---

We are very excited to announce our support for Expo with our new package `@nrwl/expo`. In addition to the React Native support, with this release of `@nrwl/expo`, you will be able to easily develop mobile apps in the monorepo. If you use Expo in a monorepo then Nx is the tool for you.

This blog will show you how to create a one-page app to display a poem:

![](/blog/images/2022-03-23/1*vDAGnOKsuXDhMDDtw7Swcg.avif)
_Page Screenshot (left: Android, right: iOS)_

Github Repo: [xiongemi/nx-expo-poetry](https://github.com/xiongemi/nx-expo-poetry)

## Before We Start

When I just started to try out Expo, the first questions came to my mind were “what is the difference between Expo and React Native” and “when to choose Expo and when to choose React Native”? In short, Expo is a set of tools built on top of React Native. You can read it more at [https://stackoverflow.com/questions/39170622/what-is-the-difference-between-expo-and-react-native](https://stackoverflow.com/questions/39170622/what-is-the-difference-between-expo-and-react-native).

Now I have created an app with Expo, to me, the most significant differences are developer experience and the build process.

![](/blog/images/2022-03-23/1*JqkWuBAXkfVVDZbQ7Kzffg.avif)
_Left: managed Expo project folder, right: React Native project folder_

For a managed Expo project, notice that it only has a `src` folder; whereas for a React Native project, besides the `src` folder, it also contains the `android` and `ios` folder. For a managed Expo project, developers do not need to worry about maintaining code for iOS and Android. However, you can still write customized native code for Expo, you can use Expo with [bare workflow](https://docs.expo.dev/introduction/managed-vs-bare/#bare-workflow) after running the command `expo eject`.

Moreover, Expo provides [Expo Application Services(EAS)](https://docs.expo.dev/eas/) to build and distribute your app. React Native developers can bundle and build locally using Android Studio or Xcode. However, with EAS Build, it will build on a hosted service. Of course, there is potentially a fee involved: [https://expo.dev/pricing](https://expo.dev/pricing).

**Something to note:** [@nrwl/expo](https://www.npmjs.com/package/@nrwl/expo) and [@nrwl/react-native](https://www.npmjs.com/package/@nrwl/react-native) cannot exist in the same monorepo due to dependency version conflicts. Expo usually tails the latest React Native by a few versions, whereas [@nrwl/react-native](https://www.npmjs.com/package/@nrwl/react-native) tries to align with the latest React Native version.

## Setup

First, let’s create an Nx workspace:

```shell
npx create-nx-workspace nx-expo-poetry --preset=empty
```

Then you need to install @nrwl/expo package:

```shell
cd nx-expo-poetry
# npm
npm install @nrwl/expo --save-dev

# yarn
yarn add @nrwl/expo --dev
```

Then you need to generate an expo app:

```shell
nx generate @nrwl/expo:app poetry-app
```

Now you should notice that under the apps folder, there are 2 folders generated: `peotry-app` and `poetry-app-e2e:`

![](/blog/images/2022-03-23/1*xLRdddGDLfGSD5wJLOpzuQ.avif)
_apps folder_

Now run the command to serve up the Expo Development Server:

```shell
nx start poetry-app
```

You should see the starter app in the simulator:

![](/blog/images/2022-03-23/1*QTtTs_ggIHyzv0b4vSGX3w.avif)
_Expo Development Server_

## Create First Page

Now we got the app running, let’s create our first page. In this example, we are going to use the [React Native Paper](https://callstack.github.io/react-native-paper/) as the material design library. To install:

```shell
# npm
npm install react-native-paper --save

# yarn
yarn add react-native-paper
```

Then, let’s create our first component. This component simply displays a poem on the page.

First, to add a component file under the app, run the below command:

```shell
nx g @nrwl/expo:component poem-of-the-day --directory=components
```

Now you should see the components under apps/components:

![](/blog/images/2022-03-23/1*HZUqQJbNUqBfPns7qqvN5w.avif)

Then paste the below code to the `App.tsx` and `poem-of-the-day.tsx`:

```tsx {% fileName="App.tsx" %}
import React from 'react';
import { SafeAreaView, ScrollView } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';

import PoemOfTheDay from '../components/poem-of-the-day/poem-of-the-day';

const App = () => {
  return (
    <PaperProvider>
      <SafeAreaView>
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <PoemOfTheDay></PoemOfTheDay>
        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
};

export default App;
```

```tsx {% fileName="poem-of-the-day.tsx" %}
import React from 'react';
import { Card, Title, Paragraph, Subheading } from 'react-native-paper';

/* eslint-disable-next-line */
export interface PoemOfTheDayProps {}

export function PoemOfTheDay(props: PoemOfTheDayProps) {
  return (
    <Card>
      <Card.Cover source={{ uri: `https://picsum.photos/300/200` }} />
      <Card.Content>
        <Title>Ozymandias</Title>
        <Subheading>Percy Bysshe Shelley</Subheading>
        <Paragraph>
          I met a traveller from an antique land {'\n'}
          Who said: Two vast and trunkless legs of stone {'\n'}
          Stand in the desert...Near them, on the sand, {'\n'}
          Half sunk, a shattered visage lies, whose frown,{'\n'}
          And wrinkled lip, and sneer of cold command, {'\n'}
          Tell that its sculptor well those passions read {'\n'}
          Which yet survive, stamped on these lifeless things, {'\n'}
          The hand that mocked them, and the heart that fed: {'\n'}
          And on the pedestal these words appear: {'\n'}
          'My name is Ozymandias, king of kings: {'\n'}
          Look on my works, ye Mighty, and despair!' {'\n'}
          Nothing beside remains. Round the decay{'\n'}
          Of that colossal wreck, boundless and bare{'\n'}
          The lone and level sands stretch far away.
        </Paragraph>
      </Card.Content>
    </Card>
  );
}

export default PoemOfTheDay;
```

Now, if you run command `nx start poetry-app` and then run the app on the simulator, you should see:

![](/blog/images/2022-03-23/1*563FtEWPwo4m93qOvFmk1Q.avif)
_Page Screenshot (left: Android, right: iOS)_

To see it in the real device, run `nx publish poetry-app`.

Awesome! Now you have built your first page. However, notice this page only displays a static poem. The next step is to integrate with the API. In this example. We are going to use PoetryDB: [https://github.com/thundercomb/poetrydb](https://github.com/thundercomb/poetrydb).

## Create a Workspace Library

To create a library that gets a random poem from the API, run the command:

```shell
nx generate @nrwl/expo:library services
```

This should generate a services folder under libs:

![](/blog/images/2022-03-23/1*7jNkHVOQpfZ6XAoWnDFc8A.avif)

Create a `poetry.service.ts` file to call the PoetryDB API and get a random poem:

```typescript {% fileName="poem-response.interfacve.ts %}
// at libs/services/src/models/poem-response.interface.ts
export interface PoemResponse {
  title: string;
  author: string;
  lines: string[];
  linecount: string;
}
```

```typescript {% fileName="poetry.service.ts" %}
// at libs/services/src/poetry/poetry.service.ts
import { PoemResponse } from '../models/poem-response.interface';

const POETRY_BASE_URL = 'https://poetrydb.org/';

export async function getPoemOfTheDay(): Promise<PoemResponse[]> {
  const response: Response = await fetch(POETRY_BASE_URL + 'random', {
    method: 'GET',
  });
  if (response.ok) {
    return await response.json();
  }
  throw response;
}

export const poetryService = { getPoemOfTheDay };
```

For the service we created above, we can import it in the app directly like:

```shell
import { PoemResponse, poetryService } from '@nx-expo-poetry/services';
```

Then the `apps/poetry-app/src/components/poem-of-the-day/poem-of-the-day.tsx` would become:

If you now run the app using `nx start poetry-app`, you should see the poem loaded from API:

![](/blog/images/2022-03-23/1*ytjIE4sXlqWHG10ltVw-Dw.avif)
_Page Screenshot (left: Android, right: iOS)_

## Using Expo Build

Now you want to build and possibly publish your app. To build the standalone app, you can use the Expo build. First, you need to create an Expo account. You can do it at [https://expo.dev/signup](https://expo.dev/signup) or using the command line:

```shell
npx expo login
```

Then you can run the build command:

```shell
# iOS
nx build-ios poetry-app

# Android
nx build-android poetry-app
```

You can monitor your builds after logging in at [https://expo.dev/](https://expo.dev/):

![](/blog/images/2022-03-23/1*MlV6Ph6KEeA6L-kMpL8FEQ.avif)
_Builds page at https://expo.dev/_

You can read more at [https://docs.expo.dev/classic/building-standalone-apps/](https://docs.expo.dev/classic/building-standalone-apps/) to debug.

## Using EAS Build

Before you start to use EAS build, you need to install EAS CLI:

```shell
npm install -g eas-cli
```

Then, you can sign up and log in to your Expo:

```shell
npx expo login
```

Then go to the app folder using `cd apps/poetry-app` and simply run:

```shell
eas build
```

You can monitor your builds after logging in at [https://expo.dev/](https://expo.dev/):

![](/blog/images/2022-03-23/1*84j3XYXVDVlvSXbX2xR29Q.avif)
_Builds page at https://expo.dev/_

To submit to the app store, run:

```shell
eas submit
```

## Conclusion

In this article, we have:

- successfully built an expo app using Nx
- add UI in the app
- create a separate library to handle services
- use EAS to build the app

With Nx, we can create as many libraries as we want to handle different concerns. It would be very handy to share and reuse libraries or have multiple apps in the same monorepo.

I hope you found this useful, and we look forward to hearing your [feedback](https://github.com/nrwl/nx-labs/issues).

If you’re new to Nx and want to learn more, visit [our docs](/getting-started/intro)**.**

_(Note, the repository with the code for this article is linked at the very top.)_

This app is also available in the app store, just search “Poem of the Day”:

Android:

[Poem of the Day](https://play.google.com/store/apps/details?id=com.exiong.poetryapp)

iOS:

![](/blog/images/2022-03-23/1*VnB0y4EDRPFExB9E8KRf1A.avif)
_Screenshot in iOS app store_
