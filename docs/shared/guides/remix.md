# Remix with Nx

In this recipe, we'll show you how to create a [Remix](https://remix.run) application with Nx.

## Create Nx Workspace

```{% command="npx create-nx-workspace acme --preset=apps" path="~/" %}
 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Enable distributed caching to make your CI faster · Yes

 >  NX   Creating your v16.3.2 workspace.

   To make sure the command works reliably in all environments, and that the preset is applied correctly,
   Nx will run "npm install" several times. Please wait.

✔ Installing dependencies with npm
✔ Successfully created the workspace: acme.

 ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


 >  NX   First time using Nx? Check out this interactive Nx tutorial.

   https://nx.dev/tutorials/package-based-repo-tutorial
```

## Install Nx Remix Plugin

```shell
npm install --save-dev @nx/remix
```

## Generate a Remix Application

```{% command="nx g @nx/remix:app myapp" path="~/acme" %}
>  NX  Generating @nx/remix:application

✔ What unit test runner should be used? · vitest

CREATE apps/myapp/project.json
UPDATE package.json
CREATE apps/myapp/README.md
CREATE apps/myapp/app/root.tsx
CREATE apps/myapp/app/routes/index.tsx
CREATE apps/myapp/public/favicon.ico
CREATE apps/myapp/remix.config.js
CREATE apps/myapp/remix.env.d.ts
CREATE apps/myapp/tsconfig.json
CREATE apps/myapp/.gitignore
CREATE apps/myapp/package.json
UPDATE nx.json
CREATE tsconfig.base.json
CREATE .prettierrc
CREATE .prettierignore
UPDATE .vscode/extensions.json
CREATE apps/myapp/vite.config.ts
CREATE apps/myapp/tsconfig.spec.json
CREATE apps/myapp/test-setup.ts
CREATE apps/myapp-e2e/cypress.config.ts
CREATE apps/myapp-e2e/src/e2e/app.cy.ts
CREATE apps/myapp-e2e/src/fixtures/example.json
CREATE apps/myapp-e2e/src/support/commands.ts
CREATE apps/myapp-e2e/src/support/e2e.ts
CREATE apps/myapp-e2e/tsconfig.json
CREATE apps/myapp-e2e/project.json
CREATE .eslintrc.json
CREATE .eslintignore
CREATE apps/myapp-e2e/.eslintrc.json
```

## Build, Serve and Test your Application

1. To build your application run:

```{% command="nx build myapp" path="~/acme" %}
> nx run myapp:build

Building Remix app in production mode...

Built in 857ms

 ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project myapp (3s)
```

2. To serve your application for use during development run:

```{% command="nx serve myapp" path="~/acme" %}
> nx run myapp:serve

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

 >  NX   Successfully ran target test for project myapp (2s)
```

## Generating an Nx Library

When developing your application, it often makes sense to split your codebase into smaller more focused libraries.

To generate a library to use in your Remix application run:

```{% command="nx g @nx/remix:lib login" path="~/acme" %}
>  NX  Generating @nx/remix:library

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

```{% command="nx g @nx/remix:route admin --project=myapp" path="~/acme" %}
>  NX  Generating @nx/remix:route

CREATE apps/myapp/app/routes/admin.tsx
CREATE apps/myapp/app/styles/admin.css
```

## Using a loader from your Library

To use a Route Loader where the logic lives in your library, follow the steps below.

1. Generate a loader for your route:

```{% command="nx g @nx/remix:loader admin --project=myapp" path="~/acme" %}
>  NX  Generating @nx/remix:loader

UPDATE apps/myapp/app/routes/admin.tsx
```

2. Add a new file in your `login` lib

`libs/login/src/lib/admin/admin.loader.ts`

```ts
import { json, LoaderArgs } from '@remix-run/node';

export const adminLoader = async ({ request }: LoaderArgs) => {
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
export const loader = async ({ request }: LoaderArgs) => {
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
