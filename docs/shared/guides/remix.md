---
title: Remix with Nx
description: Learn how to create, build, serve, and test Remix applications within an Nx workspace, leveraging Nx's powerful tooling for modern web development.
---

{% callout type="warning" title="The future of Remix is React Router" %}
Remix has announced its transition to React Router. The `@nx/remix` plugin is based on Remix v2 and is incompatible with the latest version of React Router unless you [upgrade](https://reactrouter.com/upgrading/remix) your Remix application. In the future, the `@nx/remix` plugin will be deprecated in favor of the `@nx/react/router` plugin. If you are starting a new project, we recommend using the `@nx/react/router` plugin instead.

For an example of how to use React Router with Nx, see the [React Router with Nx](/technologies/react/recipes/react-router) recipe.
{% /callout %}

# Remix with Nx

In this recipe, we'll show you how to create a [Remix](https://remix.run) application with Nx.

## Create Nx Workspace

```{% command="npx create-nx-workspace@latest acme --preset=apps" path="~/" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip
```

## Install Nx Remix Plugin

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/remix` version that is on the same minor version as the `nx` version in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

```shell {% skipRescope=true %}
nx add @nx/remix
```

## Generate a Remix Application

```{% command="nx g @nx/remix:app apps/myapp"  path="~/acme" %}
NX  Generating @nx/remix:application

✔ What unit test runner should be used? · vitest
✔ Which E2E test runner would you like to use? · playwright

UPDATE package.json
UPDATE nx.json
CREATE apps/myapp/project.json
CREATE apps/myapp/README.md
CREATE apps/myapp/app/nx-welcome.tsx
CREATE apps/myapp/app/root.tsx
CREATE apps/myapp/app/routes/_index.tsx
CREATE apps/myapp/public/favicon.ico
CREATE apps/myapp/remix.config.js
CREATE apps/myapp/remix.env.d.ts
CREATE apps/myapp/tests/routes/_index.spec.tsx
CREATE apps/myapp/tsconfig.app.json
CREATE apps/myapp/tsconfig.json
CREATE apps/myapp/.gitignore
CREATE apps/myapp/package.json
CREATE apps/myapp/tsconfig.spec.json
CREATE apps/myapp/vitest.config.ts
CREATE apps/myapp/test-setup.ts
CREATE apps/myapp/.eslintrc.json
CREATE apps/myapp/.eslintignore
CREATE apps/myapp-e2e/project.json
CREATE apps/myapp-e2e/src/example.spec.ts
CREATE apps/myapp-e2e/playwright.config.ts
CREATE apps/myapp-e2e/tsconfig.json
CREATE apps/myapp-e2e/.eslintrc.json
```

## Build, Serve and Test your Application

1. To build your application run:

```{% command="nx build myapp" path="~/acme" %}
> nx run myapp:build

Building Remix app in production mode...

Built in 857ms

——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target build for project myapp (3s)
```

2. To serve your application for use during development run:

```{% command="nx dev myapp" path="~/acme" %}
> nx run myapp:dev

💿 Building...
💿 Rebuilt in 377ms
Remix App Server started at http://localhost:3000 (http://192.168.0.14:3000)
```

3. To test the application using vitest run:

```{% command="nx test myapp" path="~/acme" %}
> nx run myapp:test

RUN  v0.31.4 /Users/columferry/dev/nrwl/issues/remixguide/acme/apps/myapp
stderr | app/routes/index.spec.ts > test > should render
Warning: Functions are not valid as a React child. This may happen if you return a Component instead of <Component /> from render. Or maybe you meant to call this function rather than return it.
✓ app/routes/index.spec.ts  (1 test) 10ms
Test Files  1 passed (1)
     Tests  1 passed (1)
Start at  16:15:45
Duration  1.20s (transform 51ms, setup 139ms, collect 180ms, tests 10ms, environment 379ms, prepare 103ms)

——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target test for project myapp (2s)
```

## Generating an Nx Library

When developing your application, it often makes sense to split your codebase into smaller more focused libraries.

To generate a library to use in your Remix application run:

```{% command="nx g @nx/remix:lib libs/login" path="~/acme" %}
NX  Generating @nx/remix:library

✔ What test runner should be used? · vitest
UPDATE nx.json
UPDATE package.json
CREATE babel.config.json
CREATE libs/login/project.json
CREATE libs/login/.eslintrc.json
CREATE libs/login/README.md
CREATE libs/login/src/index.ts
CREATE libs/login/tsconfig.lib.json
CREATE libs/login/tsconfig.json
CREATE libs/login/vite.config.ts
CREATE libs/login/tsconfig.spec.json
CREATE libs/login/src/lib/login.module.css
CREATE libs/login/src/lib/login.spec.tsx
CREATE libs/login/src/lib/login.tsx
UPDATE tsconfig.base.json
CREATE libs/login/src/test-setup.ts
CREATE libs/login/src/server.ts
```

You can then use the library by importing one of the exports into your application:

`apps/myapp/app/routes/index.tsx`

```tsx
import { Login } from '@acme/login';

export default function Index() {
  return (
    <div>
      <Login />
    </div>
  );
}
```

You can also run test on your library:

`nx test login`

## Generating a Route

To generate a route for your application:

```{% command="nx g @nx/remix:route apps/myapp/app/routes/admin" path="~/acme" %}
NX  Generating @nx/remix:route

CREATE apps/myapp/app/routes/admin.tsx
CREATE apps/myapp/app/styles/admin.css
```

## Using a loader from your Library

To use a Route Loader where the logic lives in your library, follow the steps below.

1. Generate a loader for your route:

```{% command="nx g @nx/remix:loader apps/myapp/app/routes/admin.tsx" path="~/acme" %}
NX  Generating @nx/remix:loader

UPDATE apps/myapp/app/routes/admin.tsx
```

2. Add a new file in your `login` lib

`libs/login/src/lib/admin/admin.loader.ts`

```ts
import { json, LoaderFunctionArgs } from '@remix-run/node';

export const adminLoader = async ({ request }: LoaderFunctionArgs) => {
  return json({
    message: 'Hello, world!',
  });
};
```

Export the function from the `libs/login/src/server.ts` file:

```ts
export * from './lib/admin/admin.loader';
```

3. Use the loader in your `apps/myapp/app/routes/admin.tsx`

Replace the default loader code:

```tsx
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json({
    message: 'Hello, world!',
  });
};
```

with

```tsx
import { adminLoader } from '@acme/login/server';

export const loader = adminLoader;
```

## GitHub Repository with Example

You can see an example of an Nx Workspace using Remix by clicking below.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/remix" /%}
