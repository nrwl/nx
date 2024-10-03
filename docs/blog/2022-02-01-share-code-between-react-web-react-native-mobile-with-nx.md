---
title: 'Share code between React Web & React Native Mobile with Nx'
slug: 'share-code-between-react-web-react-native-mobile-with-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-02-01/1*lL-fGNaIGYBC_eOBwSvdBw.png'
tags: [nx, tutorial]
---

**A problem I try to solve:** I got this awesome idea, not only do I want to create a web app, but I also want to create a mobile app for it. Usually creating web and mobile apps require totally different tech stacks, and it is pretty hard to share code. This article shows how I added a React web app and a React Native mobile app in the same monorepo using Nx, and how I optimized codeshare between the two.

I am mostly a web developer, so let’s start with the web app first: [https://xiongemi.github.io/studio-ghibli-search-engine](https://xiongemi.github.io/studio-ghibli-search-engine). It is a search engine for movies and characters under Studio Ghibli:

![](/blog/images/2022-02-01/1*TILaEjwvKtDTODE8Zo7wFA.avif)
_Screenshot of web app_

Example Repo: [xiongemi/studio-ghibli-search-engine](https://github.com/xiongemi/studio-ghibli-search-engine)

Github page: [https://xiongemi.github.io/studio-ghibli-search-engine](https://github.com/xiongemi/studio-ghibli-search-engine)

Now let’s create the corresponding mobile version of this app.

## Tech Stack

- Monorepo: Nx
- Web Frontend: [React](https://reactjs.org/)
- API: [https://ghibliapi.herokuapp.com/](https://ghibliapi.herokuapp.com/)

Currently, there’s only a React web app within our Nx workspace. If I run `nx graph`, the dependency graph looks like the below:

![](/blog/images/2022-02-01/1*AkrRrJ1pbALScj64T8rc_g.avif)
_Dependency graph_

## React Native Setup

To get started we need to add React Native support to our Nx workspace:

```shell
# npm
npm install @nrwl/react-native --save-dev# yarn
yarn add @nrwl/react-native --dev
```

Next, we can generate a new React Native app by running:

```shell
npx nx generate @nrwl/react-native:app studio-ghibli-search-engine-mobile
```

> Note, if you’re using VSCode you might want to try [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) for a more visual experience of running such commands.

As a result of running the above command, you should now have two new folders under the `apps` directory: `studio-ghibli-search-engine-mobile` and `studio-ghibli-search-engine-mobile-e2e`

![](/blog/images/2022-02-01/1*pKHufw-OEbTmDRyNcsAd4A.avif)
_studio-ghibli-search-engine-mobile created under apps_

If we now run `nx dep-graph` again, the dependency graph looks like this:

![](/blog/images/2022-02-01/1*UN-VoWFKTqExCCFzQeZkYA.avif)
_Dependency graph_

Note that there is no code shared between `studio-ghibli-search-engine-mobile` and `studio-ghibli-search-engine-web`. However, our goal is to reuse some of the functionality that we have previously written for the web version on our new React native version of the app.

## Code that Could NOT be Shared

Even though our goal is to share as much as possible between our React web app and the React Native app, there are parts that simply cannot be shared.

### UI

We have to rewrite all the UI components for the mobile app. Unlike [Cordova](https://cordova.apache.org/) or [Ionic](https://ionicframework.com/), React Native is NOT a webview. The JavaScript we wrote got interpreted and converted to mobile native elements. Hence we cannot simply reuse UI HTML elements written for the React web app.

Here’s a quick list of libraries we’ve used for the React web app and a corresponding React Native counterpart library we can use.

**Routing**

- [react-router-dom](https://reactrouter.com/docs/en/v6/getting-started/overview) for web
- [@react-navigation/native](https://reactnavigation.org/) for mobile

**Material Design Library**

- [@mui/material](https://mui.com/) for web
- [react-native-paper](https://callstack.github.io/react-native-paper/) for mobile

Besides the above React Native libraries, there are some core utility libraries that need to be installed:

- react-native-reanimated
- react-native-gesture-handler
- react-native-screens
- react-native-safe-area-context
- @react-native-community/masked-view
- react-native-vector-icons

The corresponding install command would be:

```shell
# npm
npm install @react-navigation/native @react-navigation/native-stack react-native-paper react-native-reanimated react-native-gesture-handler react-native-screens react-native-safe-area-context @react-native-community/masked-view --save# yarn
yarn add @react-navigation/native @react-navigation/native-stack react-native-paper react-native-reanimated react-native-gesture-handler react-native-screens react-native-safe-area-context @react-native-community/masked-view
```

### Storage

For the React Web app, we use [redux-persist](https://github.com/rt2zz/redux-persist), which persists the redux store in [`localstorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage). However, `localstorage` is not supported by React Native.

For the web, the variable `persistConfig` passed to persistStore from redux-persist is:

```typescript
import storage from 'redux-persist/lib/storage';
const persistConfig = {
  key: 'root',
  storage: storage,
  whitelist: ['search', 'films', 'people'],
  transforms: [transformEntityStateToPersist],
};
```

However, for the mobile, we need to install the library [`@react-native-async-storage/async-storage`](https://github.com/react-native-async-storage/async-storage):

```shell
# npm
npm install @react-native-async-storage/async-storage --save-dev# yarn
yarn add @react-native-async-storage/async-storage --dev
```

As a result, the `persistConfig` passed to persistStore from redux-persist becomes:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['search', 'films', 'people'],
  transforms: [transformEntityStateToPersist],
};
```

### History

On the React web app, we use [connected-react-router](https://github.com/supasate/connected-react-router) to put the router state into the Redux store. However, the [History API (windows.history)](https://developer.mozilla.org/en-US/docs/Web/API/History_API) is not supported by React Native. As an alternative, we can use `createMemoryHistory`.

For the web app, the history is:

```typescript
import { createHashHistory, History } from 'history';
const history: History = createHashHistory();
```

For the mobile app, the history is:

```typescript
import { createMemoryHistory, History } from 'history';
const history: History = createMemoryHistory();
```

To make our code more re-usable we could slightly refactor the creation of the root reducer with [connected-react-router](https://github.com/supasate/connected-react-router), such that it takes the `history` object as an argument:

```typescript
import { combineReducers } from '@reduxjs/toolkit';
import { connectRouter } from 'connected-react-router';
import { History } from 'history';
import { filmsSlice } from '../films/films.slice';
import { peopleSlice } from '../people/people.slice';
import { searchSlice } from '../search/search.slice';
import { RootState } from './root-state.interface';
export const createRootReducer = (history: History) =>
  combineReducers<RootState>({
    films: filmsSlice.reducer,
    router: connectRouter(history) as any,
    search: searchSlice.reducer,
    people: peopleSlice.reducer,
  });
```

### Query Parameters

When you develop on the web, the easiest way to pass ahead state or information, in general, is to leverage the URL query parameters. In our search app example, we can simply have something like `?search=searchText`.

We can use [react-router-dom](https://v5.reactrouter.com/web/guides/quick-start) to push a new history entry.

```typescript
import { useHistory } from 'react-router-dom';
const history = useHistory();
const submitSearchForm = (text: string) => {
  history.push(`${AppRoutes.results}?search=${text}`);
};
```

To read and parse the current query parameter `search`:

```typescript
import { useLocation } from 'react-router-dom';
const params = new URLSearchParams(useLocation().search);
const searchParam = params.get('search');
```

Although the mobile app URLs are not visible, we can still pass parameters. Note that we have to use a different package `@react-navigation/native` though.

```typescript
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
const submitSearchForm = () => {
  navigation.navigate(AppRoutes.results, { search: text });
};
```

To read and parse the parameter:

```typescript
import { RouteProp, useRoute } from '@react-navigation/native';
const route = useRoute<RouteProp<{ params: { search: string } }>>();
const searchParam = route.params?.search;
```

To type checking with typescript for react-navigation, we need to create a type `RootStackParamList` for mappings of route name to the params of the route:

```typescript
export type RootStackParamList = {
  [AppRoutes.search]: undefined;
  [AppRoutes.results]: { search: string };
};
```

We also need to specify a global type for your root navigator:

```typescript
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface RootParamList extends RootStackParamList {}
  }
}
```

So we create the stack navigator, we need to pass the above `RootStackParamList` type:

```typescript
import { createNativeStackNavigator } from '@react-navigation/native-stack';
const Stack = createNativeStackNavigator<**RootStackParamList**>();
```

### Environment Variables

Nx comes with a set of different options for [handling environment variables](/reference/environment-variables). In our workspace, we have a simple `.env` file at the workspace root:

```text
NX_REQUEST_BASE_URL=://ghibliapi.herokuapp.com
```

This works nicely for our React web build, but it doesn’t for our React Native application. This is because React Native and React apps use different Javascript bundlers. React Native uses [Metro](https://facebook.github.io/metro/) and React uses [Webpack](https://webpack.js.org/). Therefore, when we try to access `process.env.NX_REQUEST_BASE_URL`, we get `undefined`.

To solve this, we can use the [react-native-config](https://github.com/luggit/react-native-config) library

```shell
# npm
npm install react-native-config --save-dev# yarn
yarn add react-native-config --dev
```

Here’s an example of how to set up [react-native-config](https://github.com/luggit/react-native-config): [https://github.com/luggit/react-native-config#setup](https://github.com/luggit/react-native-config#setup).

After that, we can have a simple utility function to retrieve the environment variables in our app.

```typescript
import Config from 'react-native-config';
export function getEnv(envName: string) {
  return process.env[envName] || Config[envName];
}
```

To access the environment variable `NX_REQUEST_BASE_URL`, we can then simply use the above function:`getEnv(‘NX_REQUEST_BASE_URL’)`.

### Fetch With HTTP

On the web, you most probably lean on the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to make network requests. On iOS, however, you’ll get an error saying: `TypeError: Network request failed`.

It turns out that React Native does not allow HTTP requests by default: [https://stackoverflow.com/questions/38418998/react-native-fetch-network-request-failed](https://stackoverflow.com/questions/38418998/react-native-fetch-network-request-failed).

To fix this, for iOS, open `apps/studio-ghibli-search-engine-mobile/ios/StudioGhibliSearchEngineApp/Info.plist` and add the request URL to `NSExceptionDomains` under `NSAppTransportSecurity`:

```xml
<key>NSAppTransportSecurity</key>
 <dict>
  <key>NSExceptionDomains</key>
  <dict>
   <key>localhost</key>
   <dict>
    <key>NSExceptionAllowsInsecureHTTPLoads</key>
    <true/>
   </dict>
   <key>ghibliapi.herokuapp.com</key>
   <dict>
    <key>NSExceptionAllowsInsecureHTTPLoads</key>
    <true/>
   </dict>
  </dict>
 </dict>
```

Similarly, for Android, open `apps/studio-ghibli-search-engine-mobile/android/app/src/main/res/xml/network_security_config.xml`, and add the request URL to this config file:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">10.0.2.2</domain>
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">herokuapp.com</domain>
    </domain-config>
</network-security-config>
```

This should get rid of the network error.

It seems like there are quite a few customizations that need to be done for React Native apps. However, the majority of non-UI code could be reused.

## Code that Could be Shared

All the business logic code that is not UI could be shared. For this example, I got 3 libraries in my monorepo and all of them could be shared:

- models: types and interface definitions
- services: services that interact with API
- store: redux store

With Nx, it requires zero configuration to share the above library code. Even though when I created these libraries for a web app, I used commands like `nx generate @nrwl/react:lib store`, I could still use them directly in my react native mobile app.

For example, I need to create a film page to display film details with film id passed in as a parameter:

![](/blog/images/2022-02-01/1*zD_5omXSG-hIVHbgpCb-bA.avif)
_Screenshot of Film Page on Mobile (left: iOS, right: Android)_

I would do import from the store library directly:

```typescript
import {
  filmsActions,
  filmsSelectors,
  RootState,
} from '@studio-ghibli-search-engine/store';
```

The film component would become:

```typescript {% fileName="film.props.ts" %}
import { AnyAction, ThunkDispatch } from '@reduxjs/toolkit';
import {
  filmsActions,
  filmsSelectors,
  RootState,
} from '@studio-ghibli-search-engine/store';

const mapStateToProps = (state: RootState) => {
  return {
    getFilm: (id: string) => filmsSelectors.selectFilmById(id)(state),
  };
};

const mapDispatchToProps = (
  dispatch: ThunkDispatch<RootState, void, AnyAction>
) => {
  return {
    fetchFilms() {
      dispatch(filmsActions.fetchFilms());
    },
  };
};

type mapStateToPropsType = ReturnType<typeof mapStateToProps>;
type mapDispatchToPropsType = ReturnType<typeof mapDispatchToProps>;

type FilmProps = mapStateToPropsType & mapDispatchToPropsType;

export { mapStateToProps, mapDispatchToProps };
export type { FilmProps };
```

```tsx {% fileName="film.tsx" %}
import { RouteProp, useRoute } from '@react-navigation/native';
import { FilmEntity } from '@studio-ghibli-search-engine/models';
import { getEnv } from '@studio-ghibli-search-engine/services';
import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Image, View } from 'react-native';
import {
  Button,
  Divider,
  Headline,
  Paragraph,
  Subheading,
  Title,
} from 'react-native-paper';
import { styles } from 'react-native-style-tachyons';
import { connect } from 'react-redux';

import Loading from '../shared/loading/loading';
import { useLink } from '../shared/open-link/open-link';

import { FilmProps, mapDispatchToProps, mapStateToProps } from './film.props';

export function Film({ getFilm, fetchFilms }: FilmProps) {
  const [film, setFilm] = useState<FilmEntity>();

  const route = useRoute<RouteProp<{ params: { id: string } }>>();
  const id = route.params?.id;

  const openHboMax = useLink(getEnv('NX_HBO_STREAMING_URL'), 'HBO Max');
  const openNetflix = useLink(getEnv('NX_NETFLIX_STREAMING_URL'), 'Netflix');

  useEffect(() => {
    fetchFilms();
  }, [fetchFilms]);

  useEffect(() => {
    setFilm(getFilm(id));
  }, [id, getFilm]);

  return film ? (
    <SafeAreaView>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={[styles.pa3]}>
          <Image
            style={{ height: 200, width: '100%', resizeMode: 'contain' }}
            source={{ uri: film.movieBanner }}
          />
          <Headline>{film.title}</Headline>
          <Subheading>
            {film.originalTitle} / {film.originalTitleRomanised}
          </Subheading>
          <Paragraph>Release: {film.releaseDate}</Paragraph>
          <Paragraph>Director: {film.director}</Paragraph>
          <Paragraph>Producer: {film.producer}</Paragraph>
          <Paragraph>Running Time: {film.runningTime} minutes</Paragraph>
          <Paragraph>Rotten Tomatoes Score: {film.rtScore}</Paragraph>

          <Divider />

          <Title>Plot</Title>
          <Paragraph>{film.description}</Paragraph>

          <Divider />

          <Button onPress={openHboMax}>Watch on HBO Max</Button>
          <Button onPress={openNetflix}>Watch on Netflix</Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  ) : (
    <Loading />
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(Film);
```

Note I could import from `@studio-ghibli-search-engine/models`, `@studio-ghibli-search-engine/services` and `@studio-ghibli-search-engine/store` directly.

Now when I run `nx dep-graph`, it shows the dependency graph below where all these 3 libraries are shared between web and mobile:

![](/blog/images/2022-02-01/1*697qjtaGr4mTSnuRq6vpPw.avif)
_Dependency graph_

For this example project, to create the mobile app, it took me some time to rewrite the entire UI. However, I do not need to make any changes to the above libraries.

![](/blog/images/2022-02-01/1*Ldob3R4V50WG4gP-UzKAOg.avif)
_Screenshots of Mobile App (left: iOS, right: Android)_

## Conclusion

In this article, we ended up building both, a React-based web application and a corresponding React Native app in the same repository using Nx.

Nx’s architecture promotes the separation of concerns, splitting things into `apps` (which are technology-specific) and `libs` which can be technology-specific or technology-independent. That allows us to easily have our common business logic in a technology-independent library which in turn (thanks to Nx’s setup) be easily linked to both, our React web and React Native mobile app.

Although there are UI-specific differences we need to account for, that simply comes with one being a web tech stack and the other being a native app, we were still able to share big chunks of the technology-independent business logic of our application. That ultimately helps with maintenance and having feature parity across different platforms.

_(Note, the repository with the code for this article is linked at the very top)_
