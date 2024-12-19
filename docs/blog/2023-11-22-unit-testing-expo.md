---
title: Unit Testing Expo Apps With Jest
slug: 'unit-testing-expo-apps-with-jest'
authors: [Emily Xiong]
cover_image: '/blog/images/2023-11-22/featured_img.webp'
tags: [nx, tutorial]
---

In my latest [blog](/blog/step-by-step-guide-to-creating-an-expo-monorepo-with-nx), I successfully navigated through the steps of setting up an Expo Monorepo with [Nx](). The next challenge? Testing! This blog dives into:

- Crafting effective unit tests for Expo components utilizing Jest
- Addressing common issues encountered during unit testing

Repo:
{% github-repository url="https://github.com/xiongemi/nx-expo-monorepo" /%}

## Stacks

Here’s my setup

- Testing framework: [jest](https://jestjs.io/)
- Testing library: [@testing-library/react-native](https://callstack.github.io/react-native-testing-library/)
- Jest Preset: [jest-expo](https://www.npmjs.com/package/jest-expo)

## Writing and Running Unit Tests

When you use Nx, it not only configures and sets up Jest, but also creates a default unit test for every expo component that is being generated. Here’s what that looks like:

```typescript
import { render } from '@testing-library/react-native';
import React from 'react';

import Loading from './loading';

describe('Loading', () => {
  it('should render successfully', () => {
    const { root } = render(<Loading />);
    expect(root).toBeTruthy();
  });
});
```

To run all unit tests for a given project, use:

```shell
npx nx test <project-name>
```

Here’s the output of running this for my example app:

![terminal output](/blog/images/2023-11-22/bodyimg1.webp)

When it comes to writing tests, the [React Native Testing Library](https://callstack.github.io/react-native-testing-library/docs/api-queries) is a game-changer for writing cleaner unit tests in React Native applications. Its intuitive query API simplifies the process of selecting elements within your components, making it straightforward to write more maintainable and readable tests. You mark elements with a `testID`

```html
<Headline testID="title">{film.title}</Headline>
```

Then in the test file, you can use the function `getByTestId` to query `testID`:

```typescript
const { getByTestId } = render(<your component>);
expect(getByTestId('title')).toHaveTextContent(...);
```

You can find more options for querying elements on the official React Native Testing Library docs: [https://callstack.github.io/react-native-testing-library/docs/api-queries](https://callstack.github.io/react-native-testing-library/docs/api-queries).

## Troubleshooting Common Issues When Writing Tests

However, unit tests do not always pass. Here are some common errors I ran into and how to resolve them.

### Error: AsyncStorage is null.

I am using the library `@react-native-async-storage/async-storage`, and I got the below error when running unit testing:

```shell
 [@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.

    To fix this issue try these steps:

      • Rebuild and restart the app.

      • Run the packager with `--reset-cache` flag.

      • If you are using CocoaPods on iOS, run `pod install` in the `ios` directory and then rebuild and re-run the app.

      • If this happens while testing with Jest, check out docs how to integrate AsyncStorage with it: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest

    If none of these fix the issue, please open an issue on the Github repository: https://github.com/react-native-async-storage/async-storage/issues

       5 | import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
       6 | import { Platform } from 'react-native';
    >  7 | import AsyncStorage from '@react-native-async-storage/async-storage';
```

The issue is that `@react-native-async-storage/async-storage` library can only be used in `NativeModule`. Since unit testing with Jest only tests JS/TS file logic, I need to mock this library.

In the app’s test-setup.ts file, add the below lines:

```typescript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

## Error: Could not find “store”

I am using Redux for state management, and I got this error for my stateful components:

```
Could not find "store" in the context of "Connect(Bookmarks)". Either wrap the root component in a <Provider>, or pass a custom React context provider to <Provider> and the corresponding React context consumer to Connect(Bookmarks) in connect options.
```

To fix this, the simple way is to mock a redux store. I need to install [redux-mock-store](https://github.com/reduxjs/redux-mock-store) and its typing:

{% tabs %}
{% tab label="npm" %}

```shell
npm install redux-mock-store @types/redux-mock-store --save-dev
```

{% /tab %}

{% tab label="yarn" %}

```shell
yarn add redux-mock-store @types/redux-mock-store --dev
```

{% /tab %}
{% /tabs %}

Then I can create a mock store using this library like the below code:

```typescript
import configureStore, { MockStoreEnhanced } from 'redux-mock-store';

const mockStore = configureStore<any>([]);

let store: MockStoreEnhanced<any>;

beforeEach(() => {
  store = mockStore({});
  store.dispatch = jest.fn();
});
```

For example, one of my stateful components’ unit test will become:

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import configureStore, { MockStoreEnhanced } from 'redux-mock-store';
import { RootState, initialRootState } from '@nx-expo-monorepo/states/cat';

import Bookmarks from './bookmarks';

describe('Bookmarks', () => {
  const mockStore = configureStore<RootState>([]);

  let store: MockStoreEnhanced<RootState>;

  beforeEach(() => {
    store = mockStore(initialRootState);
    store.dispatch = jest.fn();
  });

  it('should render successfully', () => {
    const { container } = render(
      <Provider store={store}>
        <Bookmarks />
      </Provider>
    );
    expect(container).toBeTruthy();
  });
});
```

The above code will apply the initial redux state to my components.

### Error: No QueryClient set

Because I use [TanStack Query](https://tanstack.com/query/latest) , when I run unit tests, I have this error:

```
No QueryClient set, use QueryClientProvider to set one
```

This error occurred because I used `useQuery` from `@tanstack/react-query` in my component; however, in this unit test, the context of this hook is not provided.

To solve this, I can just mock the `useQuery` function:

```typescript
import * as ReactQuery from '@tanstack/react-query';

jest.spyOn(ReactQuery, 'useQuery').mockImplementation(
  jest.fn().mockReturnValue({
    data: 'random cat fact',
    isLoading: false,
    isSuccess: true,
    refetch: jest.fn(),
    isFetching: false,
    isError: false,
  })
);
```

### Error: Couldn’t find a navigation object

If you use `@react-navigation` library for navigation, and inside your component, there are hooks from this library like `useNavigation` and `useRoute`, you are likely to get this error:

```
Couldn't find a navigation object. Is your component inside NavigationContainer?
```

The fix this, I need to mock the `@react-nativgation/native` library. In the app’s test-setup.ts file, I need to add:

```typescript
jest.mock('@react-navigation/native', () => {
  return {
    useNavigation: () => ({
      navigate: jest.fn(),
      dispatch: jest.fn(),
      setOptions: jest.fn(),
    }),
    useRoute: () => ({
      params: {
        id: '123',
      },
    }),
  };
});
```

### SyntaxError: Unexpected token ‘export’

I got this error when using a library with ECMAScript Module (ESM), such as [`udid`](https://github.com/uuidjs/uuid):

```
 /Users/emilyxiong/Code/nx-expo-monorepo/node_modules/uuid/dist/esm-browser/index.js:1
    ({"Object.<anonymous>":function(module,exports,require,__dirname,__filename,jest){export { default as v1 } from './v1.js';
                                                                                      ^^^^^^

    SyntaxError: Unexpected token 'export'

       5 | import { connect } from 'react-redux';
       6 | import 'react-native-get-random-values';
    >  7 | import { v4 as uuidv4 } from 'uuid';
```

Jest does not work with ESM out of the box. The simple solution is to map this library to the CommonJS version of this library.

In the app’s `jest.config.ts`, there should be an option called `moduleNameMapper`. The library I used is called `uuid`, so I need to add the map `uuid: require.resolve(‘uuid’)` under `moduleNameMapper`. So when the code encounters imports from `uuid` library, it will resolve the CommonJS version of it:

```typescript
module.exports = {
  moduleNameMapper: {
    uuid: require.resolve('uuid'),
  },
};
```

Alternatively, I can also mock this library in the test files:

```typescript
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid', () => {
  return {
    v4: jest.fn(() => 1),
  };
});
```

## Error: Jest encountered an unexpected token

I got this error when I was importing from a library such as [react-native-vector-icons](https://github.com/oblador/react-native-vector-icons):

```
 console.error
      Jest encountered an unexpected token

      Jest failed to parse a file. This happens e.g. when your code or its dependencies use non-standard JavaScript syntax, or when Jest is not configured to support such syntax.

      Out of the box Jest supports Babel, which will be used to transform your files into valid JS based on your Babel configuration.

      By default "node_modules" folder is ignored by transformers.

      Here's what you can do:
       • If you are trying to use ECMAScript Modules, see https://jestjs.io/docs/ecmascript-modules for how to enable it.
       • If you are trying to use TypeScript, see https://jestjs.io/docs/getting-started#using-typescript
       • To have some of your "node_modules" files transformed, you can specify a custom "transformIgnorePatterns" in your config.
       • If you need a custom transformation specify a "transform" option in your config.
       • If you simply want to mock your non-JS modules (e.g. binary assets) you can stub them out with the "moduleNameMapper" config option.

      You'll find more details and examples of these config options in the docs:
      https://jestjs.io/docs/configuration
      For information about custom transformations, see:
      https://jestjs.io/docs/code-transformation
```

To fix this, add this library name to `transformIgnorePatterns` in the app's jest.config.ts.

What is `transformIgnorePatterns`? The `transformIgnorePatterns` allows developers to specify which files shall be transformed by Babel. `transformIgnorePatterns` is an array of regexp pattern strings that should be matched against all source file paths before the transformation. If the file path matches any patterns, it will not be transformed by Babel.

By default, Jest will ignore all the files under node_modules and only transform the files under the project’s src.

However, some libraries such as `react-native-paper` or `react-native-svg`, the library files are in `.ts` or `.tsx`. These files are not compiled to `js`. So I need to add these libraries' names to `transformIgnorePatterns`, so these libraries will be transformed by Babel along with my project. source file. The default generated `jest.config.js` already has:

```
transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
]
```

If I have an error related to a library with an unexpected token, I need to check whether they are compiled or not.

- If this library source files are already transformed to `.js`, then its name should match regex, so it would be ignored, so it will NOT be transformed.
- If this library source files are NOT transformed to `.js` (e.g. still in `.ts` or `.tsx`), then its name should NOT match regex, so it will be transformed.

## Summary

Here are some common errors that I will probably run into while doing unit testing. The solution to most problems is to find a way to mock a library that is not relevant to my component logic.

With Nx, you do not need to explicitly install any testing library, so you can dive right in and focus on writing the tests rather than spending time on setup.

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Community Discord](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](/nx-cloud)
