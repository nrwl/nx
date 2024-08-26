---
title: 'Testing React Native apps with Jest'
slug: 'testing-react-native-apps-with-jest'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-05-04/1*OXnODpoFXaimLz-m0bDu4g.png'
tags: [nx, release]
---

### How to write unit and e2e tests for React Native apps using Jest in an Nx workspace

In my previous [blog](/blog/share-code-between-react-web-react-native-mobile-with-nx), I finally finished writing my awesome Nx React Native App. The app is running fine. Can I just commit my changes and call it a wrap?

No. As a disciplined developer, I know that finishing writing application code is only a job half done; the other half is writing tests.

This blog will go through:

- How to write unit tests for React Native components
- How to write e2e tests

Example Repo: [xiongemi/studio-ghibli-search-engine](https://github.com/xiongemi/studio-ghibli-search-engine)

## Unit Testing with Nx React Native

To run unit tests, simply run:

```
nx test **<your app or lib>**
```

If you’re using Visual Studio Code, you can use [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) to run the test command:

![](/blog/images/2022-05-04/1*8vG3Qbp-vDyPFSkMEgQ2SA.avif)
_Test command in Nx Console_

You should see the unit test results in your terminal:

```
Test Suites: 10 failed, 1 passed, 11 total
Tests:       9 failed, 1 passed, 10 total
Snapshots:   0 total
Time:        9.84 s, estimated 21 s
Ran all test suites.
```

This is what a starter unit test looks like:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

import Results from './results';

describe('Results', () => {
  it('should render successfully', () => {
    const { container } = render(<Results />);
    expect(container).toBeTruthy();
  });
});
```

### Tech Stack

- Testing framework: [jest](https://jestjs.io/)
- Testing library: [@testing-library/react-native](https://callstack.github.io/react-native-testing-library/)

To write a unit test:

In your component, you can add `testID:`

```
<Headline testID='title'>{film.title}</Headline>
```

Then in the test file, you can use function `getByTestId` to query `testID`:

```
const { getByTestId } = render(<your component>);
expect(getByTestId('title')).toHaveTextContent(...);
```

You can view more queries here: [https://callstack.github.io/react-native-testing-library/docs/api-queries](https://callstack.github.io/react-native-testing-library/docs/api-queries).

The first time running the unit tests is unlikely to pass. There are usually a few errors I run into, I either have to fix the code and tests, or I need to mock some library.

## Troubleshooting

### **Error: Jest failed to parse a file**

If you are using libraries such as `react-native-paper` or `@react-navigation/native`, you are likely to run into the below error:

```
Jest encountered an unexpected tokenJest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.
```

To fix this, add that library name to `transformIgnorePatterns` in the `jest.config.js`.

For example:

```
transformIgnorePatterns: \['node\_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.\*|@expo-google-fonts/.\*|react-navigation|@react-navigation/.\*|@unimodules/.\*|unimodules|sentry-expo|native-base|react-native-svg)'\],
```

The `transformIgnorePatterns` allows developers to specify which files shall be transformed by Babel It should be an array of regexp pattern strings that are matched against all source file paths before the transformation. If the file path matches any patterns, it will not be transformed by Babel.

### Error: Animated

If you use React Native’s Animated library or you use a material library like `react-native-paper` or `react-native-elements`, you are likely to get the below warning:

```
console.warn
      Animated: \`useNativeDriver\` is not supported because the native animated module is missing. Falling back to JS-based animation. To resolve this, add \`RCTAnimation\` module to this app, or remove \`useNativeDriver\`. Make sure to run \`bundle exec pod install\` first. Read more about autolinking: [https://github.com/react-native-community/cli/blob/master/docs/autolinking.md](https://github.com/react-native-community/cli/blob/master/docs/autolinking.md)
```

In the `test-setup` file under your app or lib, add the below mock:

```
jest.mock(
  '../../node\_modules/react-native/Libraries/Animated/NativeAnimatedHelper'
);
```

### **Error: Is your component inside a screen in a navigator?**

If you use `@react-navigation` library for navigation, and inside your component, there are hooks from this library like `useNavigation` and `useRoute`, you are likely to get this error:

```
Couldn't find a route object. Is your component inside a screen in a navigator?
```

The easiest way to fix this is to mock the `@react-navigation/native` library like below in `test-setup` file under your app or lib:

```typescript
jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({
      params: {
        id: '123',
      },
    }),
  };
});
```

### **Error: Could not find “store”**

If your component is a smart component that uses Redux Store, you are going to get this error when testing that component:

```
Could not find "store" in the context of "Connect(Results)". Either wrap the root component in a <Provider>, or pass a custom React context provider to <Provider> and the corresponding React context consumer to Connect(Results) in connect options
```

To fix this, you need to wrap your component inside `<Provider store={store}>`.

First, you need to install redux-mock-store:

```shell
**_\# npm_**
npm install redux-mock-store @types/redux-mock-store --save-dev**_\# yarn_**
yarn add redux-mock-store @types/redux-mock-store --dev
```

The test would become:

```tsx
import {
  initialRootState,
  RootState,
} from '@studio-ghibli-search-engine/store';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore, { MockStoreEnhanced } from 'redux-mock-store';

import Film from './film';

describe('Film', () => {
  const mockStore = configureStore<RootState>([]);

  let store: MockStoreEnhanced<RootState>;

  beforeEach(() => {
    store = mockStore(initialRootState);
    store.dispatch = jest.fn();
  });

  it('should render successfully', () => {
    const { container } = render(
      <Provider store={store}>
        <Film />
      </Provider>
    );
    expect(container).toBeTruthy();
  });
});
```

Example unit test with different store states:

```tsx
import { mockFilmEntity } from '@studio-ghibli-search-engine/models';
import {
  initialRootState,
  RootState,
} from '@studio-ghibli-search-engine/store';
import { render } from '@testing-library/react-native';
import React from 'react';
import { Provider } from 'react-redux';
import configureStore, { MockStoreEnhanced } from 'redux-mock-store';

import Film from './film';

jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      dispatch: jest.fn(),
    }),
    useRoute: () => ({
      params: {
        id: '123',
      },
    }),
  };
});

describe('Film', () => {
  const mockStore = configureStore<RootState>([]);

  let store: MockStoreEnhanced<RootState>;

  it('should render successfully for initial state', () => {
    store = mockStore(initialRootState);
    store.dispatch = jest.fn();
    const { container } = render(
      <Provider store={store}>
        <Film />
      </Provider>
    );
    expect(container).toBeTruthy();
  });

  it('should display film if it exists in store', () => {
    store = mockStore({
      ...initialRootState,
      films: {
        loadingStatus: 'loaded',
        ids: ['123'],
        entities: { '123': mockFilmEntity },
      },
    });
    store.dispatch = jest.fn();
    const { getByTestId } = render(
      <Provider store={store}>
        <Film />
      </Provider>
    );
    expect(store.dispatch).toHaveBeenCalled();
    expect(getByTestId('title')).toHaveTextContent(mockFilmEntity.title);
  });
});
```

Here are how to write unit tests for React Native components and some common errors you are likely to run into.

Now with all the unit tests in place, I need to write e2e tests.

## E2E Testing with Nx React Native

When generating an Nx React Native app, you should see a folder ends with `e2e` created.

To run the e2e tests against Debug build:

- In one terminal, run `nx start <your app>`
- In another terminal, run:

```
**_\# iOS_**
nx test-ios <your app-e2e>**_\# Android_**
nx test-android <your app-e2e>
```

If you want to run the e2e test against Release build, run:

```
**_\# iOS_**
nx test-ios <your app-e2e> --prod**_\# Android_**
nx test-android <your app-e2e> --prod
```

### Tech Stack

- Test framework: [Detox](https://github.com/wix/Detox)
- Test runner: [jest](https://jestjs.io/)

To setup [Detox iOS env](https://github.com/wix/Detox/blob/master/docs/Introduction.iOSDevEnv.md), you need to install Install [`applesimutils`](https://github.com/wix/AppleSimulatorUtils)`:

```
brew tap wix/brew
brew install applesimutils
```

Generally, the e2e tests should follow the below pattern:

For example, my app’s starter page looks like this:

![](/blog/images/2022-05-04/1*Ldob3R4V50WG4gP-UzKAOg.avif)
_Stater page_

Here is my e2e test to check whether it displays the heading:

For my component, I added `testID` in order to be queried by e2e tests:

```html
<SafeAreaView testID='search-page'>
  ...
  <Headline testID='heading'>
    Studio Ghibli Search Engine
  </Headline>
```

For example, my app has a flow that users can search text like `totoro` and go to the film details:

![](/blog/images/2022-05-04/1*FUBUwq53wrrCCfdi9_ENvA.avif)
_Search flow_

The e2e test looks like this:

```typescript
import { device, element, by, expect } from 'detox';

describe('Search', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show a list of results and go to film details', async () => {
    await waitFor(element(by.id('search-page')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('search-input'))).toBeVisible();
    await element(by.id('search-input')).clearText();
    await element(by.id('search-input')).typeText('totoro');
    await element(by.id('search-button')).tap();
    await waitFor(element(by.id('results-page')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('result-list-item')).atIndex(0).tap();
    await waitFor(element(by.id('film-page')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('title'))).toBeVisible();
    await expect(element(by.id('title'))).toHaveText('My Neighbor Totoro');
  });
});
```

You can read more about matchers and actions in Detox here: [https://wix.github.io/Detox/docs/api/matchers](https://wix.github.io/Detox/docs/api/matchers).

## Conclusion

Here is how to test Nx React Native apps. With Nx, you do not need to explicitly install any testing library like Jest or Detox. So you can dive right in and focus on writing the tests rather than spending time on setup.

Check out my previous blog about Nx React Native: [Share code between React Web & React Native Mobile with Nx](/blog/share-code-between-react-web-react-native-mobile-with-nx)

### Where to go from here?

- [join the Nx Official Discord Server](https://go.nx.dev/community)
- [follow Nx on Twitter](https://twitter.com/nxdevtools)
- subscribe to the [Nx Youtube channel](https://youtube.com/c/Nrwl_io)
