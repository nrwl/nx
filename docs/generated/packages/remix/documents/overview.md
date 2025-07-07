---
title: Overview of the Nx Remix Plugin
description: The Nx Plugin for Remix contains executors, generators, and utilities for managing Remix applications and libraries within an Nx workspace.
---

# @nx/remix

The Nx Plugin for Remix contains executors, generators, and utilities for managing Remix applications and libraries
within an Nx workspace. It provides:

- Integration with libraries such as Storybook, Jest, Vitest, Playwright and Cypress.
- Generators to help scaffold code quickly, including:
  - Libraries, both internal to your codebase and publishable to npm
  - Routes
  - Loaders
  - Actions
  - Meta
- Utilities for automatic workspace refactoring.

## Setting up @nx/remix

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/remix` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/remix` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/remix
```

This will install the correct version of `@nx/remix`.

### How @nx/remix Infers Tasks

The `@nx/remix` plugin will create a task for any project that has a Remix configuration file present. Any of the following files will be recognized as a Remix configuration file:

- `remix.config.js`
- `remix.config.mjs`
- `remix.config.cjs`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/remix Configuration

The `@nx/remix/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/remix/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "startTargetName": "start",
        "typecheckTargetName": "typecheck"
      }
    }
  ]
}
```

The `buildTargetName`, `devTargetName`, `startTargetName` and `typecheckTargetName` options control the names of the inferred Remix tasks. The default names are `build`, `dev`, `start` and `typecheck`.

## Using the Remix Plugin

## Generate a Remix Application

```{% command="nx g @nx/remix:app apps/myapp" path="~/acme" %}
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

> remix dev --manual

💿  remix dev

info  building...
info  built (388ms)
[remix-serve] http://localhost:3000 (http://192.168.0.12:3000)
```

3. To test the application using vitest run:

```{% command="nx test myapp" path="~/acme" %}
> nx run myapp:test

> vitest


 RUN  v1.6.0 /Users/columferry/dev/nrwl/issues/gh_issues/nx26943/apps/myapp

 ✓ tests/routes/_index.spec.tsx (1)
   ✓ renders loader data

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  13:22:54
   Duration  533ms (transform 47ms, setup 68ms, collect 123ms, tests 36ms, environment 204ms, prepare 35ms)


———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Successfully ran target test for project myapp (950ms)
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
