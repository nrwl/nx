---
title: 'Step by Step Guide on Creating a Monorepo for React Native Apps using Nx'
slug: 'step-by-step-guide-on-creating-a-monorepo-for-react-native-apps-using-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2021-10-14/1*92uzyqB8oJ8tZJB9wAdoWQ.png'
tags: [nx, tutorial]
---

Do you want to have both mobile and web apps in the same repo? Do you wish that you could share code between mobile and web apps? This blog post shows you how to create a React Native mobile app and a React web app in the same repo with shared libraries using Nx.

It goes through how to create a simple 2-page app that shows your daily horoscope based on your zodiac sign.

![](/blog/images/2021-10-14/1*yqKU8cqFWP4nzAkttVyE1w.avif)
_Screenshots of Daily Horoscope App_

TL;DR — GitHub repo: [xiongemi/aztro-daily-horoscope](https://github.com/xiongemi/aztro-daily-horoscope)

## Overview

### Tech Stack

- Mobile Frontend: [React Native](https://reactnative.dev/)
- Web Frontend: [React](https://reactjs.org/)
- UI Library: [React Native Elements](https://reactnativeelements.com/)
- State Management: [Redux](https://redux.js.org/)
- Navigation: [React Navigation](https://reactnavigation.org/)
- API: [aztro](https://github.com/sameerkumar18/aztro)

### Setup

For iOS and Android development environment setup, please see [https://reactnative.dev/docs/environment-setup](https://reactnative.dev/docs/environment-setup).

To create an Nx workspace, run:

```shell
npx create-nx-workspace aztro-daily-horoscope --preset=react-native
```

To generation the application `daily-horoscope-app`, run:

```shell
nx generate application **daily-horoscope-app**
```

This should generate `daily-horoscope-app` folder under apps:

![](/blog/images/2021-10-14/1*WWfQWoOHTgH8l9uCnstTVQ.avif)
_daily-horoscope-app folder_

Now you install the starter project of Nx React Native. If you run:

- `nx run-ios daily-horoscope-app`, it should launch the app in the iOS simulator.
- `nx run-android daily-horoscope-app`, it should launch the app in the Android simulator.

## Install React Native Elements

This example uses [React Native Elements](https://reactnativeelements.com/) as its UI component library and [react-native-vector-icons](https://github.com/oblador/react-native-vector-icons) as its icon library.

To install, run:

```shell
# npm
npm install --save @rneui/base @rneui/themed react-native-vector-icons react-native-safe-area-context

# yarn
_**yarn add @rneui/base @rneui/themed react-native-vector-icons react-native-safe-area-context
```

In the app’s package.json at `apps/daily-horoscope-app/package.json`, under dependencies, add the above packages:

```json5
{
  name: 'daily-horoscope-app',
  version: '0.0.1',
  private: true,
  dependencies: {
    // other dependencies
    '@rneui/base': '*',
    'react-native-gesture-handler': '*',
    'react-native-reanimated': '*',
    'react-native-safe-area-context': '*',
    'react-native-screens': '*',
  },
}
```

### Install react-native-vector-icons for iOS

There are additional steps needed to add the icon font files to the iOS and Android bundle.

In `apps/daily-horoscope-app/ios/Podfile` file, add below line before `post_install`:

```podfile
pod 'RNVectorIcons', :path => '../../../node\_modules/react-native-vector-icons'
```

In `apps/daily-horoscope-app/ios/DailyHoroscope/Info.plist` file, add below key array pair before the closing `</dict>` tag:

```plist
 <key>UIAppFonts</key>
 <array>
  <string>AntDesign.ttf</string>
  <string>Entypo.ttf</string>
  <string>EvilIcons.ttf</string>
  <string>Feather.ttf</string>
  <string>FontAwesome.ttf</string>
  <string>FontAwesome5\_Brands.ttf</string>
  <string>FontAwesome5\_Regular.ttf</string>
  <string>FontAwesome5\_Solid.ttf</string>
  <string>Foundation.ttf</string>
  <string>Ionicons.ttf</string>
  <string>MaterialIcons.ttf</string>
  <string>MaterialCommunityIcons.ttf</string>
  <string>SimpleLineIcons.ttf</string>
  <string>Octicons.ttf</string>
  <string>Zocial.ttf</string>
  <string>Fontisto.ttf</string>
 </array>
```

Go to the iOS folder at `apps/daily-horoscope-app/ios` and run `Pod install`. After running the command, you should see there are some changes in `Podfile.lock` file.

### Install react-native-vector-icons for Android

In file `apps/daily-horoscope-app/android/app/build.gradle`, add below line at end of the file:

```gradle
apply from: "../../../../node\_modules/react-native-vector-icons/fonts.gradle"
```

Great! You have installed the UI component library and icon library.

## Create a Page in React Native

Now, you need to create the first page of your app: a page that shows a list of all the zodiac signs and allows users to choose from it.

### Create Models

First, create a library for the models:

```
nx generate lib models
```

This should generate a models folder under libs:

![](/blog/images/2021-10-14/1*CduoANBuFeigb68ZIiebxg.avif)
_models folder under libs_

Then under this models folder, create a file to have the below enum that contains all the zodiac signs:

```
export enum AdhZodiacSign {
  Aries = 'Aries',
  Taurus = 'Taurus',
  Gemini = 'Gemini',
  Cancer = 'Cancer',
  Leo = 'Leo',
  Virgo = 'Virgo',
  Libra = 'Libra',
  Scorpio = 'Scorpio',
  Sagittarius = 'Sagittarius',
  Capricorn = 'Capricorn',
  Aquarius = 'Aquarius',
  Pisces = 'Pisces',
}
```

**Note**: the enum has a prefix “Adh” to indicate it is a model under domain “aztro-daily-horoscope”. Add this prefix to distinguish model names from component names.

This example uses icons from [Material Community Icons](https://materialdesignicons.com/). You need to create a list that contains the zodiac sign name and its matching icon.

```typescript {%fileName="zodiac-sign-item.interface.ts" %}
import { AdhZodiacSign } from './zodiac-sign.enum';

export interface AdhZodiacSignItem {
  icon: string;
  zodiacSign: AdhZodiacSign;
}
```

```typescript {%fileName="zodiac-sign-list.const.ts" %}
import { AdhZodiacSignItem } from './zodiac-sign-item.interface';
import { AdhZodiacSign } from './zodiac-sign.enum';

export const AdhZodiacSignList: AdhZodiacSignItem[] = [
  {
    zodiacSign: AdhZodiacSign.Aries,
    icon: 'zodiac-aries',
  },
  {
    zodiacSign: AdhZodiacSign.Taurus,
    icon: 'zodiac-taurus',
  },
  {
    zodiacSign: AdhZodiacSign.Gemini,
    icon: 'zodiac-gemini',
  },
  {
    zodiacSign: AdhZodiacSign.Cancer,
    icon: 'zodiac-cancer',
  },
  {
    zodiacSign: AdhZodiacSign.Leo,
    icon: 'zodiac-leo',
  },
  {
    zodiacSign: AdhZodiacSign.Virgo,
    icon: 'zodiac-virgo',
  },
  {
    zodiacSign: AdhZodiacSign.Libra,
    icon: 'zodiac-libra',
  },
  {
    zodiacSign: AdhZodiacSign.Scorpio,
    icon: 'zodiac-scorpio',
  },
  {
    zodiacSign: AdhZodiacSign.Sagittarius,
    icon: 'zodiac-sagittarius',
  },
  {
    zodiacSign: AdhZodiacSign.Capricorn,
    icon: 'zodiac-capricorn',
  },
  {
    zodiacSign: AdhZodiacSign.Aquarius,
    icon: 'zodiac-aquarius',
  },
  {
    zodiacSign: AdhZodiacSign.Pisces,
    icon: 'zodiac-pisces',
  },
];
```

### Create a Component for Zodiac Sign List

Then, create a library for the UI and create a component `zodiac-sign-list`:

```shell
nx generate lib ui
nx generate component zodiac-sign-list --project=ui --export
```

This generates the folder `zodiac-sign-list` under `ui/src/lib`.

In the `libs/ui/src/lib/zodiac-sign-list/zodiac-sign-list.tsx` file, add the below code. It uses the [FlatList](https://reactnative.dev/docs/flatlist) component from react-native and the [ListItem](https://reactnativeelements.com/docs/listitem) component from React Native Elements. It is going to pass`AdhZodiacSignList` from the`models` library you created above to the FlatList component.

```tsx {% fileName="zodiac-sign-list.tsx" %}
import {
  AdhZodiacSignItem,
  AdhZodiacSignList,
} from '@aztro-daily-horoscope/models';
import React from 'react';
import { FlatList } from 'react-native';
import { ListItem } from '@rneui/base';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

export function ZodiacSignList() {
  const keyExtractor = (item: AdhZodiacSignItem) => item.zodiacSign;

  return (
    <FlatList
      keyExtractor={keyExtractor}
      data={AdhZodiacSignList}
      renderItem={({ item }) => (
        <ListItem bottomDivider>
          <Icon name={item.icon} />
          <ListItem.Content>
            <ListItem.Title>{item.zodiacSign}</ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron />
        </ListItem>
      )}
    />
  );
}
```

In the `apps/daily-horoscope-app/src/app/App.tsx` file, you could now use the above `zodiac-sign-list` component:

```tsx {% fileName="app.tsx" %}
import * as React from 'react';
import { ZodiacSignList } from '@aztro-daily-horoscope/ui';
import { Header } from '@rneui/base';

const App = () => {
  return (
    <>
      <Header centerComponent={{ text: 'Daily Horoscope' }} />
      <ZodiacSignList />
    </>
  );
};

export default App;
```

If you run `nx run-ios daily-horoscope-app` and `nx run-android daily-horoscope-app`, you should see something like:

![](/blog/images/2021-10-14/1*-6HpGqGYxKk0xoqdYo1ihg.avif)
_Left: iOS simulator, right: Android simulator_

You have created the first page of your app.

If you run the command `nx dep-graph`, you should see what the dependency graph looks like below:

![](/blog/images/2021-10-14/1*Gwhu91TPPZzjtDIMU07__w.avif)
_Dependency graph_

The next step is to handle action when users pressed on a list item. To achieve that, it is going to use Redux.

## Add Redux

This example uses [Redux](https://redux.js.org/) as state management.

Now add a library called `store`:

```shell
nx generate lib store
```

### Create a State for Horoscope

Run command to create a redux state for horoscope:

```shell
nx generate @nrwl/react:redux horoscope --project=store --directory=horoscope
```

In the terminal, it should output:

```text
CREATE libs/store/src/lib/horoscope/horoscope.slice.spec.ts
CREATE libs/store/src/lib/horoscope/horoscope.slice.ts
```

`.slice` file is an extension introduced by [Redux Toolkit](https://redux-toolkit.js.org/). It is just a shorthand way to create actions + reducers + selectors in one file.

Notice in the package.json, this command also adds packages: [@reduxjs/toolkit](https://redux-toolkit.js.org/) and [react-redux](https://react-redux.js.org/).

Next, you are going to add a new value `zodiacSignItem` in the `HoroscopeState` to store the zodiac sign user selected. In the `libs/store/src/lib/horoscope/horoscope.slice.ts` file, the `HoroscopeState` will become:

```typescript
export interface HoroscopeState {
  loadingStatus: 'not loaded' | 'loading' | 'loaded' | 'error';
  error?: string;
  **zodiacSignItem?: AdhZodiacSignItem;**
}
```

Under `horoscopeSlice`, add an action to the reducers to change `zodiacSignItem` in the state:

```typescript
export const horoscopeSlice = createSlice({
  name: HOROSCOPE_FEATURE_KEY,
  initialState: initialHoroscopeState,
  reducers: {
    setUserZodiacSignItem(
      state: HoroscopeState,
      action: PayloadAction<AdhZodiacSignItem>
    ) {
      state.zodiacSignItem = action.payload;
    },
    ...
  },
  ...
});
```

### Create Root Store

Now you need to setup up the root reducer and configure the store. Create a root folder under `libs/store/src/lib` and add the below files:

```typescript {% fileName="root-state.initial.ts" %}
import { initialHoroscopeState } from '../horoscope/horoscope.slice';

import { RootState } from './root-state.interface';

export const initialRootState: RootState = {
  horoscope: initialHoroscopeState,
};
```

```typescript {% fileName="root-state.interface.ts" %}
import { HoroscopeState } from '../horoscope/horoscope.slice';

export interface RootState {
  horoscope: HoroscopeState;
}
```

```typescript {% fileName="root.reducer.ts" %}
import { combineReducers } from '@reduxjs/toolkit';

import { horoscopeSlice } from '../horoscope/horoscope.slice';

import { RootState } from './root-state.interface';

export const rootReducer = combineReducers<RootState>({
  horoscope: horoscopeSlice.reducer,
});
```

```typescript {% fileName="root.store.ts" %}"
import { configureStore } from '@reduxjs/toolkit';

import { initialRootState } from './root-state.initial';
import { rootReducer } from './root.reducer';

declare const process: any;

const isDevelopment = process.env.NODE_ENV === 'development';

const rootStore = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: isDevelopment,
  preloadedState: initialRootState,
});

export { rootStore };
```

### Dispatch Action from zodiac-sign-list Component

You now need to dispatch `setUserZodiacSignItem` action from `libs/ui/src/lib/zodiac-sign-list/zodiac-sign-list.tsx` component.

Create a file at`libs/ui/src/lib/zodiac-sign-list/zodiac-sign-list.props.ts`, and add a function `mapDispatchToProps`. In this function, dispatch the `setUserZodiacSignItem` action.

```typescript {% fileName="zodiac-sign-list.props.ts" %}"
import { AdhZodiacSignItem } from '@aztro-daily-horoscope/models';
import { horoscopeActions } from '@aztro-daily-horoscope/store';
import { Dispatch } from '@reduxjs/toolkit';

const mapDispatchToProps = (dispatch: Dispatch) => {
  return {
    setUserZodiacSignItem(zodiacSignItem: AdhZodiacSignItem) {
      dispatch(horoscopeActions.setUserZodiacSignItem(zodiacSignItem));
    },
  };
};

type mapDispatchToPropsType = ReturnType<typeof mapDispatchToProps>;

type ZodiacSignListProps = mapDispatchToPropsType;

export { mapDispatchToProps, ZodiacSignListProps };
```

The component `zodiac-sign-list` needs to import from the above `zodiac-sign-list.props` file. Then the component `zodiac-sign-list` becomes:

```tsx {% fileName="zodiac-sign-list.tsx" %}
import {
  AdhZodiacSignItem,
  AdhZodiacSignList,
} from '@aztro-daily-horoscope/models';
import React from 'react';
import { FlatList } from 'react-native';
import { ListItem } from '@rneui/base';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { connect } from 'react-redux';

import {
  ZodiacSignListProps,
  mapDispatchToProps,
} from './zodiac-sign-list.props';

export function ZodiacSignList({ setUserZodiacSignItem }: ZodiacSignListProps) {
  const keyExtractor = (item: AdhZodiacSignItem) => item.zodiacSign;

  return (
    <FlatList
      keyExtractor={keyExtractor}
      data={AdhZodiacSignList}
      renderItem={({ item }) => (
        <ListItem bottomDivider onPress={() => setUserZodiacSignItem(item)}>
          <Icon name={item.icon} />
          <ListItem.Content>
            <ListItem.Title>{item.zodiacSign}</ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron />
        </ListItem>
      )}
    />
  );
}

export const ZodiacSignListContainer = connect(
  null,
  mapDispatchToProps
)(ZodiacSignList);
```

Notice that a container component is added. This container component is stateful that connects to the redux state.

```typescript
export const ZodiacSignListContainer = connect(
  null,
  mapDispatchToProps
)(ZodiacSignList);
```

This container component passes down props `ZodiacSignListProps` to `ZodiacSignList`. So this prop `setUserZodiacSignItem` got called at the press event for ListItem: `onPress={() => setUserZodiacSignItem(item)}`.

### Add Provider to App

Go back to the app file at `apps/daily-horoscope-app/src/app/App.tsx`, now you need to replace the `ZodiacSignList` with `ZodiacSignListContainer`, and add the provider for the root store.

```tsx {% fileName="zodiac-sign-list.tsx" %}
import * as React from 'react';
import { Provider } from 'react-redux';
import { rootStore } from '@aztro-daily-horoscope/store';
import { ZodiacSignListContainer } from '@aztro-daily-horoscope/ui';
import { Header } from '@rneui/base';

const App = () => {
  return (
    <Provider store={rootStore}>
      <Header centerComponent={{ text: 'Daily Horoscope' }} />
      <ZodiacSignListContainer />
    </Provider>
  );
};

export default App;
```

Awesome! So every time a zodiac sign item in the list got pressed, action gets dispatched and it should update the state with the zodiac sign selected.

### Debugging Redux

First, you need to install [redux-logger](https://github.com/LogRocket/redux-logger):

```shell
# npm
npm install --save-dev redux-logger @types/redux-logger

#yarn
yarn add redux-logger @types/redux-logger --dev
```

Then you need to add the redux-logger to the root store’s middleware, so the rootStore becomes:

```typescript
import logger from 'redux-logger';
const rootStore = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    isDevelopment
      ? getDefaultMiddleware().concat(logger)
      : getDefaultMiddleware(),
  devTools: isDevelopment,
  preloadedState: initialRootState,
});
```

Since the code is running in simulators, how to use the Redux Devtools extension and view the Redux Logger?

Open the debug menu in the simulator by entering `d` in the terminal that runs the start command. Then in the debug menu, choose “Debug with Chrome” for iOS and “Debug” for Android.

![](/blog/images/2021-10-14/1*4QVoNHRjzW0agHGnxyWvpw.avif)
_Debug Menu in iOS and Android_

Install tool React Native Debugger: [https://github.com/jhen0409/react-native-debugger](https://github.com/jhen0409/react-native-debugger).

Now inside React Native Debugger, you should be able to use Redux Devtools and Redux Logger. Now if you press any zodiac sign from the list, you should see action `horoscope/setUserZodiacSignItem` got dispatched and the state is updated.

![](/blog/images/2021-10-14/1*pTbVOfaAbCvW1Kcn3RzzfQ.avif)
_React Native Debugger_

Now you have successfully set up the Redux store for your app. The next step is to navigate to a different screen when you have successfully selected a zodiac sign.

## Adding Navigation

### Setup

To add navigation, you need to install [React Navigation](https://reactnavigation.org/) library:

```shell
# npm
npm install --save @react-navigation/native @react-navigation/stack react-native-reanimated react-native-gesture-handler react-native-screens @react-native-community/masked-view

# yarn
yarn add @react-navigation/native @react-navigation/stack react-native-reanimated react-native-gesture-handler react-native-screens @react-native-community/masked-view
```

In the app’s package.json at `apps/daily-horoscope-app/package.json`, under dependencies, add the above packages:

```json5
{
  name: 'daily-horoscope-app',
  version: '0.0.1',
  private: true,
  dependencies: {
    // other dependencies
    '@react-native-masked-view/masked-view': '*',
    '@react-navigation/native': '*',
    '@react-navigation/stack': '*',
    'react-native-gesture-handler': '*',
    'react-native-reanimated': '*',
    'react-native-screens': '*',
  },
}
```

Go to the iOS folder at `apps/daily-horoscope-app/ios/Podfile` and run `Pod install`.

In `apps/daily-horoscope-app/src/main.tsx` file, add below line at top of the file:

```typescript
import 'react-native-gesture-handler';
```

### Update App to Use React Navigation

Now you need to update the `apps/daily-horoscope-app/src/app/App.tsx` file to use [React Navigation](https://reactnavigation.org/). Instead of displaying `ZodiacSignListContainer` component directly, now it is going to be passed to `Stack.Screen`. The `apps/daily-horoscope-app/src/app/App.tsx` file looks like below:

```tsx
import { store } from '@aztro-daily-horoscope/store';
import { ZodiacSignListContainer } from '@aztro-daily-horoscope/ui';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as React from 'react';
import { Provider } from 'react-redux';

const Stack = createStackNavigator();

const App = () => {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Zodiac Sign List"
            component={ZodiacSignListContainer}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

export default App;
```

If you run the code in the simulator, the app should look similar to before except for the header.

![](/blog/images/2021-10-14/1*X_A3v107SDFSmYWwBhki1A.avif)
_Add React Navigation in iOS and Android simulator_

### Create Second Page

Now you need to create the 2nd page to be navigated. Create a component called `horoscope-card` under ui:

```shell
nx generate component horoscope-card --project=ui --export
```

This should generate `libs/ui/src/lib/horoscope-card` folder.

Add the below code to `libs/ui/src/lib/horoscope-card/horoscope-card.tsx`. For now, this component is going to use mock static data. It just displays a title for the zodiac Leo. It uses the [Card](https://reactnativeelements.com/docs/card) component from React Native Elements.

```tsx {% fileName="horoscope-card.tsx" %}
import { AdhZodiacSign } from '@aztro-daily-horoscope/models';
import React from 'react';
import { Card, Text } from '@rneui/base';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

/* eslint-disable-next-line */
export interface HoroscopeCardProps {}

export function HoroscopeCard(props: HoroscopeCardProps) {
  return (
    <Card>
      <Card.Title>
        <Icon name="zodiac-leo" size={40} />
      </Card.Title>
      <Card.Title>{AdhZodiacSign.Leo}</Card.Title>
      <Card.Divider />
      <Text h4 style={{ width: '100%', textAlign: 'center' }}>
        Your Horoscope for Today
      </Text>
    </Card>
  );
}

export default HoroscopeCard;
```

### Navigate Between Screens

Now you need to add this screen to your app. In file `apps/daily-horoscope-app/src/app/App.tsx`, you need to update it to add a stack screen for the `horoscope-card` component:

```tsx
import { store } from '@aztro-daily-horoscope/store';
import {
  ZodiacSignListContainer,
  HoroscopeCard,
} from '@aztro-daily-horoscope/ui';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as React from 'react';
import { Provider } from 'react-redux';

const Stack = createStackNavigator();

const App = () => {
  return (
    <Provider store={store}>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen
            name="Zodiac Sign List"
            component={ZodiacSignListContainer}
          />
          <Stack.Screen name="Horoscope Card" component={HoroscopeCard} />
        </Stack.Navigator>
      </NavigationContainer>
    </Provider>
  );
};

export default App;
```

In the `libs/ui/src/lib/zodiac-sign-list/zodiac-sign-list.tsx`, you need to trigger navigation when the list item got pressed.

Below code uses [`useNavigation`](https://reactnavigation.org/docs/use-navigation/) hook from [React Navigation](https://reactnavigation.org/) library. When the list item got pressed, it is going to call `navigation.navigate(‘Horoscope Card’)` to navigate the `horoscope-card` component you created above.

[https://gist.github.com/xiongemi/c78c719e70aa4948b98e68033d7fe4a3](https://gist.github.com/xiongemi/c78c719e70aa4948b98e68033d7fe4a3)

```tsx {% fileName="App.tsx" %}
import {
  AdhZodiacSignItem,
  AdhZodiacSignList,
} from '@aztro-daily-horoscope/models';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { FlatList } from 'react-native';
import { ListItem } from 'react-native-elements';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { connect } from 'react-redux';

import {
  ZodiacSignListProps,
  mapDispatchToProps,
} from './zodiac-sign-list.props';

export function ZodiacSignList({ setUserZodiacSignItem }: ZodiacSignListProps) {
  const navigation = useNavigation();
  const keyExtractor = (item: AdhZodiacSignItem) => item.zodiacSign;
  const zodiacListItemPress = (item: AdhZodiacSignItem) => {
    navigation.navigate('Horoscope Card');
    setUserZodiacSignItem(item);
  };

  return (
    <FlatList
      keyExtractor={keyExtractor}
      data={AdhZodiacSignList}
      renderItem={({ item }) => (
        <ListItem bottomDivider onPress={() => zodiacListItemPress(item)}>
          <Icon name={item.icon} />
          <ListItem.Content>
            <ListItem.Title>{item.zodiacSign}</ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron />
        </ListItem>
      )}
    />
  );
}

export const ZodiacSignListContainer = connect(
  null,
  mapDispatchToProps
)(ZodiacSignList);
```

Now you should be able to navigate between 2 screens.

![](/blog/images/2021-10-14/1*kA79kriH_l3OTWSvB5iQZQ.avif)
_Navigate between 2 screens_

## Integrate with API

Now you need to update`horoscope-card` with real data. This example uses a free and open API: [https://github.com/sameerkumar18/aztro](https://github.com/sameerkumar18/aztro).

### Add Services

First, generate a library called services:

```shell
nx generate lib services
```

In the services folder, add the below files:

- `aztro-horoscope-response.interface.ts` defines what the response object looks like. It has a transform function to transform response data to the app domain model.
- `aztro.service.ts` calls the API to get the user’s horoscope based on the zodiac sign and day.

```typescript {% fileName="aztro-horoscope-response.interface.ts" %}
import { AdhHoroscope, AdhZodiacSign } from '@aztro-daily-horoscope/models';

export interface AztroHoroscpeResponse {
  date_range: string;
  current_date: string;
  description: string;
  compatibility: string;
  mood: string;
  color: string;
  lucky_number: string;
  lucky_time: string;
}

export function transfromAztroHoroscpeResponseToAdhHoroscope(
  responose: AztroHoroscpeResponse
): AdhHoroscope {
  return {
    currentDate: new Date(responose.current_date),
    description: responose.description,
    compatibility: responose.compatibility as AdhZodiacSign,
    mood: responose.mood,
    color: responose.color,
    luckyNumber: parseInt(responose.lucky_number),
    luckyTime: responose.lucky_time,
  };
}
```

```typescript {% fileName="aztro.service.ts" %}
import { AdhHoroscopeDay, AdhZodiacSign } from '@aztro-daily-horoscope/models';

import { AztroHoroscpeResponse } from './aztro-horoscope-response.interface';

async function getHoroscope(
  zodiacSign: AdhZodiacSign,
  day: AdhHoroscopeDay
): Promise<AztroHoroscpeResponse> {
  const response = await fetch(
    `https://aztro.sameerkumar.website/?sign=${zodiacSign}&day=${day}`
  );
  if (response.ok) {
    return response.json();
  }
  throw response;
}

export const aztroService = { getHoroscope };
```

You also need to add 2 more files to the `models` library:

- `horoscope-day.type.ts` defines the allowed day value to pass to API.
- `horoscope.interface.ts` is the app domain interface that is transformed from the API response data.

```typescript {% fileName="horoscope-day.type.ts" %}
export type AdhHoroscopeDay = 'today' | 'tomorrow' | 'yesterday';
```

```typescript {% fileName="horoscope.interface.ts" %}
import { AdhZodiacSign } from './zodiac-sign.enum';

export interface AdhHoroscope {
  currentDate: Date;
  description: string;
  compatibility: AdhZodiacSign;
  mood: string;
  color: string;
  luckyNumber: number;
  luckyTime: string;
}
```

### Connect to Redux

Now you need to create action to call `aztro.service` and store its response to the redux state.

Now you need to update the interface for the horoscope state value in file `libs/store/src/lib/horoscope/horoscope.slice.ts`:

```typescript
import {
  AdhHoroscope,
  AdhHoroscopeDay,
  AdhZodiacSignItem,
} from '@aztro-daily-horoscope/models';

export interface HoroscopeState {
  loadingStatus: 'not loaded' | 'loading' | 'loaded' | 'error';
  error?: string;
  zodiacSignItem?: AdhZodiacSignItem;
  day?: AdhHoroscopeDay;
  horoscope?: AdhHoroscope;
}
```

- `loadingStatus` is the API request status from `aztro.service`.
- `error` is the API request error from `aztro.service`.
- `zodiacSignItem` is the user’s selected zodiac sign.
- `day` is the parameter passed to `aztro.service`.
- `horoscope` is the transformed response from `aztro.service.`

Then, you need to update this file to add a thunk action and reducers to fetch the horoscope:

```typescript {% fileName="horoscope.slice.ts" %}
export const fetchHoroscope = createAsyncThunk<
  AdhHoroscope,
  { zodiacSign: AdhZodiacSign; day: AdhHoroscopeDay }
>('horoscope/fetchStatus', async ({ zodiacSign, day }, { rejectWithValue }) => {
  try {
    const horoscopeResponse = await aztroService.getHoroscope(zodiacSign, day);
    return transfromAztroHoroscpeResponseToAdhHoroscope(horoscopeResponse);
  } catch (error) {
    return rejectWithValue({ error });
  }
});

export const horoscopeSlice = createSlice({
  name: HOROSCOPE_FEATURE_KEY,
  initialState: initialHoroscopeState,
  reducers: {
    setUserZodiacSignItem(
      state: HoroscopeState,
      action: PayloadAction<AdhZodiacSignItem>
    ) {
      state.zodiacSignItem = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHoroscope.pending, (state: HoroscopeState) => {
        state.loadingStatus = 'loading';
      })
      .addCase(
        fetchHoroscope.fulfilled,
        (state: HoroscopeState, action: PayloadAction<AdhHoroscope>) => {
          state.horoscope = action.payload;
          state.loadingStatus = 'loaded';
        }
      )
      .addCase(fetchHoroscope.rejected, (state: HoroscopeState, action) => {
        state.loadingStatus = 'error';
        state.error = action.error.message;
      });
  },
});
```

It adds a thunk action and its corresponding reducers:

- `fetchHoroscope`is going to call `aztro.service`.
- `fetchHoroscope.pending` is dispatched when `fetchHoroscope` is triggered
- `fetchHoroscope.fulfilled` is dispatched when `aztro.service` returns a successful response. It is going to assign the `state.horoscope` with its response
- `fetchHoroscope.rejected` is dispatched when `aztro.service` returns a failed response.

Now you need to pass the redux state value to your `horoscope-card` component. Add below selectors to this file. These are pure functions that take the root state as input and derive data from it:

```typescript {% fileName="horoscope.slice.ts" %}
const getHoroscopeState = (rootState: RootState): HoroscopeState =>
  rootState[HOROSCOPE_FEATURE_KEY];

const getUserZodiacItem = (
  rootState: RootState
): AdhZodiacSignItem | undefined => getHoroscopeState(rootState).zodiacSignItem;

const getUserZodiac = (rootState: RootState): AdhZodiacSign | undefined =>
  getUserZodiacItem(rootState)?.zodiacSign;

const getUserHoroscope = (rootState: RootState): AdhHoroscope | undefined =>
  getHoroscopeState(rootState).horoscope;

const getHoroscopeLoadingStatus = (rootState: RootState): LoadingStatus =>
  getHoroscopeState(rootState).loadingStatus;

export const horoscopeSelectors = {
  getUserZodiacItem,
  getUserZodiac,
  getUserHoroscope,
  getHoroscopeLoadingStatus,
};
```

To summarize, the file `libs/store/src/lib/horoscope/horoscope.slice.ts` will become like below:

```typescript {% fileName="horoscope.slice.ts" %}
import {
  AdhHoroscope,
  AdhHoroscopeDay,
  AdhZodiacSign,
  AdhZodiacSignItem,
} from '@aztro-daily-horoscope/models';
import {
  aztroService,
  transfromAztroHoroscpeResponseToAdhHoroscope,
} from '@aztro-daily-horoscope/services';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

import { LoadingStatus } from '../models/loading-status.type';
import { RootState } from '../root/root-state.interface';

export const HOROSCOPE_FEATURE_KEY = 'horoscope';
export interface HoroscopeState {
  loadingStatus: LoadingStatus;
  error?: string;
  zodiacSignItem?: AdhZodiacSignItem;
  day?: AdhHoroscopeDay;
  horoscope?: AdhHoroscope;
}

export const fetchHoroscope = createAsyncThunk<
  AdhHoroscope,
  { zodiacSign: AdhZodiacSign; day: AdhHoroscopeDay }
>('horoscope/fetchStatus', async ({ zodiacSign, day }, { rejectWithValue }) => {
  try {
    const horoscopeResponse = await aztroService.getHoroscope(zodiacSign, day);
    return transfromAztroHoroscpeResponseToAdhHoroscope(horoscopeResponse);
  } catch (error) {
    return rejectWithValue({ error });
  }
});

export const initialHoroscopeState: HoroscopeState = {
  loadingStatus: 'not loaded',
};

export const horoscopeSlice = createSlice({
  name: HOROSCOPE_FEATURE_KEY,
  initialState: initialHoroscopeState,
  reducers: {
    setUserZodiacSignItem(
      state: HoroscopeState,
      action: PayloadAction<AdhZodiacSignItem>
    ) {
      state.zodiacSignItem = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHoroscope.pending, (state: HoroscopeState) => {
        state.loadingStatus = 'loading';
      })
      .addCase(
        fetchHoroscope.fulfilled,
        (state: HoroscopeState, action: PayloadAction<AdhHoroscope>) => {
          state.horoscope = action.payload;
          state.loadingStatus = 'loaded';
        }
      )
      .addCase(fetchHoroscope.rejected, (state: HoroscopeState, action) => {
        state.loadingStatus = 'error';
        state.error = action.error.message;
      });
  },
});

/*
 * Export reducer for store configuration.
 */
export const horoscopeReducer = horoscopeSlice.reducer;
export const horoscopeActions = { fetchHoroscope, ...horoscopeSlice.actions };

const getHoroscopeState = (rootState: RootState): HoroscopeState =>
  rootState[HOROSCOPE_FEATURE_KEY];

const getUserZodiacItem = (
  rootState: RootState
): AdhZodiacSignItem | undefined => getHoroscopeState(rootState).zodiacSignItem;

const getUserZodiac = (rootState: RootState): AdhZodiacSign | undefined =>
  getUserZodiacItem(rootState)?.zodiacSign;

const getUserHoroscope = (rootState: RootState): AdhHoroscope | undefined =>
  getHoroscopeState(rootState).horoscope;

const getHoroscopeLoadingStatus = (rootState: RootState): LoadingStatus =>
  getHoroscopeState(rootState).loadingStatus;

export const horoscopeSelectors = {
  getUserZodiacItem,
  getUserZodiac,
  getUserHoroscope,
  getHoroscopeLoadingStatus,
};
```

Then update `horoscope-card` component with the below code. Notice inside `mapStateToProps` function, it uses selector functions from above.

```typescript {% fileName="horoscope-card.props.ts" %}
import { AdhHoroscopeDay, AdhZodiacSign } from '@aztro-daily-horoscope/models';
import {
  horoscopeActions,
  horoscopeSelectors,
  RootState,
} from '@aztro-daily-horoscope/store';
import { AnyAction, ThunkDispatch } from '@reduxjs/toolkit';

const mapStateToProps = (state: RootState) => {
  return {
    zodiacItem: horoscopeSelectors.getUserZodiacItem(state),
    horoscope: horoscopeSelectors.getUserHoroscope(state),
    loadingStatus: horoscopeSelectors.getHoroscopeLoadingStatus(state),
  };
};

const mapDispatchToProps = (
  dispatch: ThunkDispatch<RootState, void, AnyAction>
) => {
  return {
    getUserHoroscope(zodiacSign: AdhZodiacSign, day: AdhHoroscopeDay) {
      dispatch(horoscopeActions.fetchHoroscope({ zodiacSign, day }));
    },
  };
};

type mapStateToPropsType = ReturnType<typeof mapStateToProps>;
type mapDispatchToPropsType = ReturnType<typeof mapDispatchToProps>;

type HoroscopeCardProps = mapStateToPropsType & mapDispatchToPropsType;

export { mapStateToProps, mapDispatchToProps, HoroscopeCardProps };
```

```tsx {% fileName="horoscope-card.tsx" %}
import { LoadingStatus } from '@aztro-daily-horoscope/store';
import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView } from 'react-native';
import { Card, Text } from 'react-native-elements';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { connect } from 'react-redux';

import {
  mapStateToProps,
  mapDispatchToProps,
  HoroscopeCardProps,
} from './horoscope-card.props';

export function HoroscopeCard({
  zodiacItem,
  horoscope,
  loadingStatus,
  getUserHoroscope,
}: HoroscopeCardProps) {
  useEffect(() => {
    if (zodiacItem?.zodiacSign) {
      getUserHoroscope(zodiacItem.zodiacSign, 'today');
    }
  }, [zodiacItem, getUserHoroscope]);

  return (
    <SafeAreaView>
      <ScrollView>
        <Card>
          <Card.Title>
            <Icon name={zodiacItem?.icon} size={40} />
          </Card.Title>
          <Card.Title>{zodiacItem?.zodiacSign}</Card.Title>
          <Card.Divider />
          <Text h4 style={{ width: '100%', textAlign: 'center' }}>
            Your Horoscope for Today
          </Text>
          {loadingStatus === LoadingStatus.Success ? (
            <>
              <Text style={{ marginTop: 10 }}>{horoscope.description}</Text>
              <Text style={{ marginTop: 10 }}>Mood: {horoscope.mood}</Text>
              <Text style={{ marginTop: 10 }}>Color: {horoscope.color}</Text>
              <Text style={{ marginTop: 10 }}>
                Compatibility: {horoscope.compatibility}
              </Text>
              <Text style={{ marginTop: 10 }}>
                Lucky Number: {horoscope.luckyNumber}
              </Text>
              <Text style={{ marginTop: 10 }}>
                Lucky Time: {horoscope.luckyTime}
              </Text>
            </>
          ) : loadingStatus === LoadingStatus.Error ? (
            <Text h2>Oops! Something went wrong. Please try agian.</Text>
          ) : (
            <ActivityIndicator />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

export const HoroscopeCardContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(HoroscopeCard);
```

Notice inside the `horoscope-card` component, it has a hook to dispatch action `getUserHoroscope` when this component got mounted.

```typescript
useEffect(() => {
  if (zodiacItem?.zodiacSign) {
    getUserHoroscope(zodiacItem.zodiacSign, 'today');
  }
}, [zodiacItem, getUserHoroscope]);
```

In the App component, replace `HoroscopeCard` with `HoroscopeCardContainer`:

```tsx
 <Stack.Screen
    name="Horoscope Card"
    component={**HoroscopeCardContainer**}
  />
```

Now when you run the app, it should display the horoscope according to the zodiac user selected.

![](/blog/images/2021-10-14/1*yqKU8cqFWP4nzAkttVyE1w.avif)
_Horoscope Card integrated with API_

Finally, you got a mobile app that runs on both Android and iOS. You could reuse the libraries to create a web app.

If you run command `nx dep-graph`, you should see the dependency graph looks like below:

![](/blog/images/2021-10-14/1*gel7mQ8k4jDkCABq3-itpw.avif)
_Dependency Graph_

## Create Web App

First, generate a React app called `daily-horoscope-app`:

```shell
nx generate @nrwl/react:app daily-horoscope-app
```

You could reuse `store`, `models`, and `services` libraries and write a separate ui for the React web app. However, this example just reuses `ui` library and displays React Native components directly. To do so, it needs to install package [react-native-web](https://necolas.github.io/react-native-web/):

```shell
# npm
npm install --save react-native-web
npm install --save-dev babel-plugin-react-native-web

# yarn
yarn add react-native-web
yarn add --dev babel-plugin-react-native-web
```

For `apps/daily-horoscope-web/src/main.tsx`, change it to:

```typescript
import { AppRegistry } from 'react-native';
import App from './app/app';
AppRegistry.registerComponent('main', () => App);
AppRegistry.runApplication('main', {
  rootTag: document.getElementById('root'),
});
```

Copy your code from `daily-horoscope-app`’s app file to `daily-horoscope-web`’s app file and add styles for the icon font files:

```tsx {% fileName="app.tsx" %}
import { rootStore } from '@aztro-daily-horoscope/store';
import {
  ZodiacSignListContainer,
  HoroscopeCardContainer,
} from '@aztro-daily-horoscope/ui';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as React from 'react';
import { Provider } from 'react-redux';

const Stack = createStackNavigator();

const App = () => {
  return (
    <>
      <style type="text/css">{`
        @font-face {
          font-family: 'MaterialIcons';
          src: url(${require('react-native-vector-icons/Fonts/MaterialIcons.ttf')}) format('truetype');
        }
        @font-face {
          font-family: 'MaterialCommunityIcons';
          src: url(${require('react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf')}) format('truetype');
        }
      `}</style>
      <Provider store={rootStore}>
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen
              name="Zodiac Sign List"
              component={ZodiacSignListContainer}
            />
            <Stack.Screen
              name="Horoscope Card"
              component={HoroscopeCardContainer}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </Provider>
    </>
  );
};

export default App;
```

```js {% fileName="webpack.js" %}
const getWebpackConfig = require('@nrwl/react/plugins/webpack');

function getCustomWebpackConfig(webpackConfig) {
  const config = getWebpackConfig(webpackConfig);
  const isProduction = webpackConfig.mode === 'production';

  if (!isProduction) {
    config.resolve.alias = {
      'react-native': 'react-native-web',
    };

    config.module.rules.push(
      {
        test: /\.ttf$/,
        loader: require.resolve('file-loader'),
        options: { esModule: false, name: 'static/media/[path][name].[ext]' },
      },
      {
        test: /\.(js|jsx)$/,
        exclude: function (content) {
          return (
            /node_modules/.test(content) &&
            !/\/react-native-elements\//.test(content) &&
            !/\/react-native-vector-icons\//.test(content) &&
            !/\/react-native-ratings\//.test(content)
          );
        },
        use: {
          loader: require.resolve('@nrwl/web/src/utils/web-babel-loader.js'),
          options: {
            presets: [
              [
                '@nrwl/react/babel',
                {
                  runtime: 'automatic',
                  useBuiltIns: 'usage',
                },
              ],
            ],
            plugins: ['react-native-web'],
          },
        },
      }
    );
  }

  return config;
}

module.exports = getCustomWebpackConfig;
```

Then you need a customized Webpack file. It adds 2 additional rules to read the icon font files and React Native Elements library files.

Also in `workspace.json`, change the webpackConfig under daily-horoscope-web to point this custom webpack file like:

```text
"webpackConfig": "apps/daily-horoscope-web/webpack.js"
```

Now if you run `nx serve daily-horoscope-web`, it should the web app in the browser.

![](/blog/images/2021-10-14/1*w7SscyvUFlujPqwXb-QN-w.avif)
_Web App_

Now the dependency graph should look like:

![](/blog/images/2021-10-14/1*hIHwQPhh9_DOGIJokxLX4g.avif)
_Dependency Graph_

## Conclusion

Congratulations! You have created a React Native mobile app and a React web app. Nx + React + React Native is a powerful tool that allows you to have both mobile and web app code in the same repo with shared business logic.
