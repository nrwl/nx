---
title: React Router with Nx
description: Learn how to create, build, serve, and test React Router applications within an Nx workspace, leveraging Nx's powerful tooling for modern web development.
---

## React Router with Nx

React Router is the successor of Remix and is the recommended routing library for new projects that may require Server-Side Routing (SSR).

There are three modes when using React Router: `framework`, `declarative` and `data`. `Framework` mode is the most comprehensive and is what will be covered in this recipe.

We'll show you how to create a [React Router](https://reactrouter.com/home) application with Nx.

## Create Nx Workspace

```{% command="npx create-nx-workspace@latest acme --preset=apps" path="~/" %}

✔ Which stack do you want to use? · react
✔ What framework would you like to use? · none
✔ Application name · acme
✔ Would you like to use React Router for server-side rendering [https://reactrouter.com/]? · Yes
```

## Have an existing App?

If you already have an existing React Router application and want to add Nx to it you can do so by running the following command:

```shell
npx nx init
```

## Generate a React Router Application

If you would like to generate a new React Router application, you can do so by running the following command in your Nx workspace

```{% command="nx g @nx/react:app apps/happynrwl --routing --use-react-router"  path="~/acme" %}

```

There is no need to install any additional plugins to use React Router with Nx. The `@nx/react` plugin already includes support for React Router.

## Running the Application

Now that you have created your React Router application with Nx you can build, serve and test with the following commands:

### Build

To build your application run the following command:

```{% command="nx build happynrwl"  path="~/acme" %}

> nx run acme:happynrwl

> react-router build

vite v6.2.1 building for production...
✓ 45 modules transformed.
build/client/.vite/manifest.json                  1.40 kB │ gzip:  0.32 kB
build/client/assets/about-D7ArdXr1.js             0.20 kB │ gzip:  0.18 kB
build/client/assets/with-props-CQyfqcsx.js        0.22 kB │ gzip:  0.19 kB
build/client/assets/root-BKqDrCrU.js              0.99 kB │ gzip:  0.54 kB
build/client/assets/app-DnLbn-a2.js              24.50 kB │ gzip:  6.26 kB
build/client/assets/chunk-K6CSEXPM-DXuCqE6i.js  111.05 kB │ gzip: 37.47 kB
build/client/assets/entry.client-CkXnIIWp.js    179.95 kB │ gzip: 56.93 kB
✓ built in 576ms
vite v6.2.1 building SSR bundle for production...
✓ 9 modules transformed.
build/server/.vite/manifest.json   0.17 kB
build/server/index.js             43.12 kB
✓ built in 35ms



 NX   Successfully ran target build for project happynrwl (1s)
```

### Serve (Development)

To serve your application for development use the following command:

```{% command="nx dev happynrwl"  path="~/acme" %}
> nx run happynrwl:dev

> react-router dev

1:30:42 p.m. [vite] (client) Re-optimizing dependencies because lockfile has changed
  ➜  Local:   http://localhost:4200/
  ➜  press h + enter to show help
```

### Serve (Production)

To serve your application's production build use the following command:

```{% command="nx start happynrwl"  path="~/acme" %}
> nx run happynrwl:build

> react-router build

vite v6.2.1 building for production...
✓ 45 modules transformed.
build/client/.vite/manifest.json                  1.40 kB │ gzip:  0.32 kB
build/client/assets/about-D7ArdXr1.js             0.20 kB │ gzip:  0.18 kB
build/client/assets/with-props-CQyfqcsx.js        0.22 kB │ gzip:  0.19 kB
build/client/assets/root-BKqDrCrU.js              0.99 kB │ gzip:  0.54 kB
build/client/assets/app-DnLbn-a2.js              24.50 kB │ gzip:  6.26 kB
build/client/assets/chunk-K6CSEXPM-DXuCqE6i.js  111.05 kB │ gzip: 37.47 kB
build/client/assets/entry.client-CkXnIIWp.js    179.95 kB │ gzip: 56.93 kB
✓ built in 576ms
vite v6.2.1 building SSR bundle for production...
✓ 9 modules transformed.
build/server/.vite/manifest.json   0.17 kB
build/server/index.js             43.12 kB
✓ built in 35ms

> nx run happynrwl:start

> react-router-serve build/server/index.js

[react-router-serve] http://localhost:3000 (http://192.168.0.112:3000)
```

{% callout type="note" title="PORT" %}
The default port for `production` is 3000 if you want to change it use the PORT environment variable
{% /callout %}

### Unit Test

To unit test the application run the following command:

```{% command="nx test happynrwl"  path="~/acme" %}
> nx run happynrwl:test

> vitest


 RUN  v3.0.8 /private/tmp/projects/acme/apps/happynrwl

 ✓ tests/routes/_index.spec.tsx (1 test) 45ms
   ✓ renders loader data

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  13:40:29
   Duration  807ms (transform 59ms, setup 0ms, collect 168ms, tests 45ms, environment 372ms, prepare 52ms)
```

## Generate a Route

By default a route is generated for you when you create a new React Router application. If you would like to generate a new route you can do so by running the following command:

```{% command="nx g @nx/react:component --path=apps/happynrwl/app/routes/contact"  path="~/happynrwl" %}
CREATE apps/happynrwl/app/routes/contact.tsx
CREATE apps/happynrwl/app/routes/contact.module.scss
CREATE apps/happynrwl/app/routes/contact.spec.tsx
```

Now we have create a new route called `contact` in our application. Let's add that route to our `routes.tsx` file.

```tsx
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index('./app.tsx'),
  route('about', './routes/about.tsx')
  route('contact', './routes/contact.tsx')
  ] satisfies RouteConfig;
```

Now if we serve or app and navigate to `https://localhost:4200/contact` we will see our new route.

## GitHub Repository with Example

You can find an example of an Nx Workspace using React Router by clicking below

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/react-router" /%}
