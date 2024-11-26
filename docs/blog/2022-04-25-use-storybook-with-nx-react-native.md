---
title: 'Use Storybook with Nx React Native'
slug: 'use-storybook-with-nx-react-native'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-04-25/1*64nWVfUBihlYTLGWOvnc1g.png'
tags: [nx, release]
---

In my previous [blogs](/blog/share-code-between-react-web-react-native-mobile-with-nx) _(see links at the end)_, I wrote about how to develop Nx React Native applications. However, as developers, we are constantly searching for ways to make the developer experience better.

This blog will show how to add Storybook to Nx React Native applications. With Nx, you don’t need to go through [this long guideline](https://storybook.js.org/tutorials/intro-to-storybook/react-native/en/get-started/) to set up the Storybook, you can quickly get it running.

Example Repo: [xiongemi/studio-ghibli-search-engine](https://github.com/xiongemi/studio-ghibli-search-engine)

Storybook:

![](/blog/images/2022-04-25/1*bDKKjnrt2D6XIBDnWN1z2Q.avif)
_Storybook View (left: Android, right: iOS)_

## Setup

First, you need to add `@nrwl/storybook` to your existing Nx React Native workspace:

```shell
# npm
npm install @nrwl/storybook --save-dev

# yarn
yarn add --dev @nrwl/storybook
```

Then you need to generate the storybook configuration for your app or lib:

```shell
nx g @nrwl/react-native:storybook-configuration **<your app or lib>**
```

As shown in the example below, 3 folders got generated:

- `.storybook` at workspace root
- `.storybook` in your app or lib
- `storybook` in your app (Note: this folder is for creating the Storybook UI component. It will only be created for the app, you will not see this for lib.)

![](/blog/images/2022-04-25/1*q1sX4VQKdRzQpye6Qcs2Ow.avif)

If you choose to automatically generate `*.stories` file, you should see the default story looks like below:

```tsx {% fileName="loading.stories.tsx" %}
import { storiesOf } from '@storybook/react-native';
import React from 'react';

import { Loading } from './loading';

const props = {};

storiesOf('Loading', module).add('Primary', () => <Loading {...props} />);
```

To gather the stories you created, run the command:

```shell
nx storybook **<your app or lib>**
```

You should see in the terminal saying:

```shell
Writing to <your workspace>/.storybook/story-loader.js
```

In your `<your workspace>/.storybook/story-loader.js`, it should list your stories created under your app or lib similar to the below example:

```javascript {% fileName="story-loader.js" %}
// Auto-generated file created by react-native-storybook-loader
// Do not edit.
//
// https://github.com/elderfo/react-native-storybook-loader.git

function loadStories() {
  require('../apps/studio-ghibli-search-engine-mobile/src/app/App.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/film/film.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/results/film-list-item/film-list-item.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/results/people-list-item/people-list-item.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/results/result-list-item/result-list-item.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/search/search.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/shared/film-card/film-card.stories');
  require('../apps/studio-ghibli-search-engine-mobile/src/app/shared/loading/loading.stories');
}

const stories = [
  '../apps/studio-ghibli-search-engine-mobile/src/app/App.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/film/film.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/results/film-list-item/film-list-item.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/results/people-list-item/people-list-item.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/results/result-list-item/result-list-item.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/search/search.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/shared/film-card/film-card.stories',
  '../apps/studio-ghibli-search-engine-mobile/src/app/shared/loading/loading.stories',
];

module.exports = {
  loadStories,
  stories,
};
```

Also, notice that in your app’s main file, the import of the App changed to `storybook/toggle-storybook`:

```typescript
import App from './storybook/toggle-storybook';
```

### View Storybook for App

To view the storybook on the simulator/emulator/device, start the app like you usually do:

```shell
# iOS
nx run-ios <your app>

# Android
nx run-android <your app>
```

In your simulator/emulator/device, open the Debug Menu by entering `d` in terminal. You should see the menu option Toggle Storybook in the Debug Menu:

![](/blog/images/2022-04-25/1*aziO6KSwVhtXWwfyADGbAA.avif)
_Screenshot of Debug menu (left: Android, right: iOS)_

When switching on the toggle, you should see the list of your component stories:

![](/blog/images/2022-04-25/1*KYn3sPUpBU_ewRh2zJ7niQ.avif)
_Storybook View (left: Android, right: iOS)_

### View Storybook for Lib

Note: the storybook can only be viewed inside an app. To view the storybook for lib in the workspace, you need to first set up the storybook for an app in the workspace.

Then run the command:

```shell
nx storybook **<your lib>**
```

This should update the `.storybook/story-loader.js` with stories in your lib.

Then just run the command to start your app, you should see the storybook for your lib.

## Troubleshooting

### Error: Couldn’t find a navigation object

If you are using the library `@react-navigation/native` and you are using hooks like `useNavigtion` and `useRoute` inside your component, you are likely to get the below error:

![](/blog/images/2022-04-25/1*oKNqqay19gpvIRgW1QGbkA.avif)
_Render Error for Couldn’t find a navigation object_

The easiest way is just to mock this library and create a [decorator](https://storybook.js.org/docs/react/writing-stories/decorators) for it:

```typescript {% fileName="src/storybook/mocks/navigation.tsx" %}
import { NavigationContainer } from '@react-navigation/native';
import React from 'react';

export const NavigationDecorator = (story) => {
  return (
    <NavigationContainer independent={true}>{story()}</NavigationContainer>
  );
};
```

_Mock Navigation Decorator_

Then in your story, you just need to add the above `NavigationDecorator`:

```tsx
import { storiesOf } from '@storybook/react-native';
import { mockFilmEntity } from '@studio-ghibli-search-engine/models';
import React from 'react';

import { NavigationDecorator } from '../../../storybook/mocks/navigation';

import FilmListItem from './film-list-item';

storiesOf('FilmListItem', module)
  .addDecorator(NavigationDecorator)
  .add('Primary', () => <FilmListItem film={mockFilmEntity} />);
```

_Add NavigationDecoration to the story_

Now, this error should go away and you should see your component in your storybook.

If your component is using the `useRoute` hook and expecting certain routing parameters, then you need to customize the mock `NavigationDecorator` for your component. For example, below is a component that is expecting an id from the route parameters:

```typescript
const route = useRoute<RouteProp<{ params: { id: string } }>>();
const id = route.params?.id;
```

The mock `NavigationDecorator` will become:

```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

const NavigationDecorator = (story) => {
  const Stack = createNativeStackNavigator();
  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator>
        <Stack.Screen
          name="MyStorybookScreen"
          component={story}
          initialParams={{ id: 123 }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

### Error: Could not find “store”

If you are using Redux store and your component is stateful and connected to the store, you are likely to get the below error:

![](/blog/images/2022-04-25/1*T-Lj4PjuAlb_TbpSU5_1PQ.avif)
_Render Error for Could not find “store”_

The simple solution is to mock the store. First, you need to install the library [redux-mock-store](https://github.com/reduxjs/redux-mock-store) and its typing:

```shell
# npm
npm install redux-mock-store @types/redux-mock-store --save-dev# yarn
yarn add redux-mock-store @types/redux-mock-store --dev
```

Similarly, like how you mock up the navigation, you need to mock up the store. The below example mocks the store with the initial root state:

```typescript {% fileName="src/storybook/mocks/store.tsx" %}
import {
  initialRootState,
  RootState,
} from '@studio-ghibli-search-engine/store';
import React from 'react';
import { Provider as StoreProvider } from 'react-redux';
import configureStore from 'redux-mock-store';

export const StoreDecorator = (story) => {
  const mockStore = configureStore<RootState>([]);
  const store = mockStore(initialRootState);
  return <StoreProvider store={store}>{story()}</StoreProvider>;
};
```

You can add this store decorator to your story:

```tsx {% fileName="people-list-item.stories.tsx" %}
import { storiesOf } from '@storybook/react-native';
import { mockPeopleEntity } from '@studio-ghibli-search-engine/models';
import React from 'react';

import { NavigationDecorator, StoreDecorator } from '../../../storybook/mocks';

import PeopleListItem from './people-list-item';

storiesOf('PeopleListItem', module)
  .addDecorator(StoreDecorator)
  .addDecorator(NavigationDecorator)
  .add('Primary', () => <PeopleListItem people={mockPeopleEntity} />);
```

### Error: Actions must be plain objects

If you use an async action (for example, an action created using `createAsyncThunk` from `@reduxjs/toolkit`), you would likely run into the below error: Actions must be plain objects.

![](/blog/images/2022-04-25/1*sJXG_eFpItyPt7ilyF19fw.avif)
_Render Error for Actions must be plain objects_

Now to resolve this, add thunk to mock store middleware:

```tsx {% fileName="store.tsx" %}
import {
  initialRootState,
  RootState,
} from '@studio-ghibli-search-engine/store';
import React from 'react';
import { Provider as StoreProvider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

export const StoreDecorator = (story) => {
  const mockStore = configureStore<RootState>([thunk]);
  const store = mockStore({ ...initialRootState });
  return <StoreProvider store={store}>{story()}</StoreProvider>;
};
```

## Conclusion

Here are how to use Storybook with Nx React Native and some common errors you may run into. With Nx React Native, you can quickly view Storybook with a toggle option in Debug Menu. It allows developers to interact and test with components during development.

### Where to go from here?

- [Step by Step Guide on Creating a Monorepo for React Native Apps using Nx](/blog/step-by-step-guide-on-creating-a-monorepo-for-react-native-apps-using-nx)
- [Share code between React Web & React Native Mobile with Nx](/blog/share-code-between-react-web-react-native-mobile-with-nx)
- [join the Nx Official Discord Server](https://go.nx.dev/community)
- [follow Nx on Twitter](https://twitter.com/nxdevtools)
- subscribe to the [Nx Youtube channel](https://youtube.com/c/Nrwl_io)
