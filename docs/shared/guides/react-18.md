# React 18 Migration

[React 18](https://reactjs.org/blog/2022/03/29/react-v18.html) released with many new features, such as Concurrent React, Suspense, batched updates, and more.

Workspaces that upgrade to `@nrwl/react` 14 will be automatically migrated to React 18. This migration will also include an upgrade to React Router v6, if it is used in the workspace, as well as the removal of the deprecated `@testing-library/react-hook` package. Keep reading for more details.

**Note:** If you use npm v7/v8, you will need to use `npm install --force` after running `nx migrate 14.0.0` since `@testing-library/react-hook` does not support React 18. Don't worry, this package will be removed in the migration.

## New `react-dom/client` API

Nx will automatically update your applications to use the new `react-dom-/client` API.

From this:

```typescript jsx
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom';
import App from './app/app';

ReactDOM.render(
  <StrictMode>
    <App />
  </StrictMode>,
  document.getElementById('root')
);
```

To this:

```typescript jsx
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

There might be additional changes needed for your code to be fully compatible with React 18. If you use `React.FC` type (which Nx does not use), then you will need to
update your component props to include `children` explicitly.

Before:

```typescript jsx
interface MyButtonProps {
  color: string;
}
```

After:

```typescript jsx
interface MyButtonProps {
  color: string;
  children?: React.ReactNode; // children is no longer implicitly provided by React.FC
}
```

For more information on React 18 migration, please see the [official guide](https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html).

## Changes to Strict Mode

React 18 brings a [change to Strict Mode](https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html#updates-to-strict-mode) that requires
effects to be resilient to mounting and unmounting multiple times.

This change means that in development mode, React will simulate mounting and unmounting an effect, even though the component using the effect
only mounts once. Note that this _does not_ affect production.

In practice, this change means that if you use an effect without dependencies, such as the following.

```typescript jsx
useEffect(() => {
  console.log('running effect');
  return () => {
    console.log('clean up');
  };
}, []);
```

Then, in React 18 with Strict Mode, you'll see the following logged:

```text
running effect
clean up
running effect
```

This behavior is problematic if the effect cannot run twice, say if you fetch data or perform expensive computation. To fix it, you can use a _ref_.

```typescript jsx
const hasRun = useRef(false);

useEffect(() => {
  if (!hasRun.current) {
    hasRun.current = true;
    console.log('running effect');
  }
  return () => {
    console.log('clean up');
  };
}, []);
```

Alternatively, you can switch Strict Mode off, which might be a good temporary solution until you are able to fix all the problematic effects in your workspace. To turn Strict Mode off, delete the `<Strict>` element the application's `main.tsx`. If you are using Next.js, you can use the [`reactStrictMode`](https://nextjs.org/docs/api-reference/next.config.js/react-strict-mode) setting in your `next.config.js` file.

## React Router v6

In addition to the React 18 migration, Nx will also update your workspace to React Router v6 -- assuming you use React Router v5 previously.
There are breaking changes in React Router v6. Please refer to the official [v5 to v6 guide](https://reactrouter.com/docs/en/v6/upgrading/v5) for details.

We highly recommend teams to upgrade their workspace to v6, but if you choose to opt out and continue to use v5, then you will need to disable React strict mode. Navigation is broken in strict mode for React Router v5 due to a transition issue.

To disable strict mode, open your `main.tsx` file and remove `<Strict>` in your render function.

Before:

```typescript jsx
root.render(
  <Strict>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Strict>
);
```

After (for React Router v5):

```typescript jsx
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
```

## `@testing-library/react-hook` is deprecated

The `@testing-library/react-hook` package provides a `renderHook` function to test custom hooks. Unfortunately, this package
does not support React 18, and has been deprecated. The good news is that `@testing-library/react` (RTL) now comes with its own
`renderHook` utility function since version 13.1.0.

Nx will migrate your code to import `renderHook` from `@testing-library/react` instead of the deprecated package. There are a couple of
utility functions missing from the RTL package: `waitForNextUpdate` and `waitForValueToChange`. If you use either of these
utility functions, try swapping them with `waitFor` instead.

If you continue to have issues after the migration, please open an issue on the RTL repo: https://github.com/testing-library/react-testing-library.
