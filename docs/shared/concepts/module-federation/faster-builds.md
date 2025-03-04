---
title: Faster Builds with Module Federation
description: Learn how Module Federation in Nx enables faster builds by splitting large SPAs into smaller remote applications while minimizing common downsides.
---

# Faster Builds with Module Federation

As applications grow, builds can become unacceptably slow, which leads to slow CI/CD pipelines and long dev-server
startup times. This slowness
decreases team productivity due to long waits for local compilation, and clogged up CI/CD pipelines.

Module Federation provides a solution to the scaling problem by allowing a Single Page Application (SPA) to be sliced
into multiple smaller
remote applications that are built independently. There are some costs to slicing an application through Module
Federation:

- Cognitive overhead of developing multiple applications versus a SPA.
- Coordinating build and deployment across many applications is a huge headache, especially in a multi-repo setup.
- Version-Mismatch-Hell where different applications are deployed with different versions of shared libraries can lead
  to unexpected errors.

Nx provides the best experience for teams that want faster builds, but want to also minimize the downsides that come
with Module Federation. Starting in Nx 14,
we provide specialized generators, executors, and utilities that make Module Federation easy to set up and work with.

## When should I use Module Federation?

Whether Module Federation makes sense for your team depends on the size of your application. Although Nx hides most of
the complexity around Module Federation, it still comes with some downsides:

- Developers need to think about which remotes they are working on, since it is a waste of CPU and memory to run _all_
  remotes in development mode. In practice this may not be a problem if the teams are already divided by domain or
  feature.
- Increased orchestration since remotes are independent of each other, shared state may require the host application to
  coordinate it between remotes. For example, sharing Redux state across remotes is more complicated versus a SPA.

{% callout type="note" title="Nx Saves Machine Resources" %}
As Nx knows the remote applications that your host application depends on, it will serve your remote applications automatically when you serve your host.  
To prevent dev machines from running out of resources, and allowing for a smoother DX, a technique is employed to build your remote applications first, then
they will all be served by a single file server (`http-server`).

We have tested this in a workspace that contains 100 remote applications and found that it allows for scaling the DX very well, without causing resource issues.
{% /callout %}

## Architectural overview

With Module Federation, a large application is split into:

1. A single **Host** application that references external...
2. **Remote** applications, which handle a single domain or feature.

In the next section, we will see an example with a host app (`host`) and three remotes (`shop`, `cart`, `about`).
Although all the applications are independently built, thus have no dependency between them, conceptually you can think
of them in the following hierarchy.

![Host with implicit dependencies to remotes](/shared/concepts/module-federation/dep-graph-2.png)

## Creating an example workspace

The best way to understand the setup is through an example. In this section, we will create a `host` application with
three remotes under these routes:

1. `/shop`
1. `/cart`
1. `/about`

But before we begin, we've put together a couple of example repos (React and Angular) for you to inspect if you want to
skip ahead.

{% github-repository url="https://github.com/nrwl/ng-module-federation" /%}

{% github-repository url="https://github.com/nrwl/react-module-federation" /%}

These examples have fully
functioning [CI](https://github.com/nrwl/react-module-federation/blob/main/.github/workflows/ci.yml) [workflows](https://github.com/nrwl/ng-module-federation/blob/main/.github/workflows/ci.yml)
that are simple to set up. You can see what the CI does by viewing the sample pull requests in each repo. Also notice
the [Nx Cloud](https://nx.app) integration, which gives you insight into each pipeline. We'll touch on
this [later in this guide](#remote-computation-caching-with-nx-cloud).

![Nx Cloud integration for GitHub](/shared/concepts/module-federation/pull-request.png)

Now, let's continue by creating an empty Nx workspace.

```shell
# Replace acme with desired scope
npx create-nx-workspace acme --preset=apps
cd acme
```

{% callout type="check" title="Enabling remote caching" %}
You will be prompted to enable Nx Cloud in the workspace. For the best experience, we highly recommend using Nx Cloud to
take advantage of remote caching and other features it provides.
{% /callout %}

Then, for React users, install the `@nx/react` plugin; and for Angular users, install the `@nx/angular` plugin.

```shell
# If you use React
nx add @nx/react

# If you use Angular
nx add @nx/angular
```

Next, generate the host and remote applications.

{% tabs %}
{% tab label="React" %}

```shell
nx g @nx/react:host apps/host --remotes=shop,cart,about
```

{% /tab %}
{% tab label="Angular" %}

```shell
nx g @nx/angular:host apps/host --remotes=shop,cart,about
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="More details" %}
You can leave off the `--remotes` option and add them later with `nx g @nx/react:remote apps/shop --host=host`
or `nx g @nx/angular:remote apps/shop --host=host`.
{% /callout %}

Now, serve `host` to view it in your browser.

```shell
nx serve host --open
```

The above command serves `host` in development mode, whereas the remotes are built and served statically. That is,
changes to `host` will update its bundle, but changes to remotes will not update.

To run one or more remotes in development mode, use the `--devRemotes` option.

```shell
nx serve host --open --devRemotes="shop,cart"
```

The above command starts the `shop` and `cart` remotes in development mode, but `about` will remain static.

{% callout type="note" title="More details" %}
Both commands serve the whole system. By passing `--devRemotes`, you configure what parts of it you will be changing.
For instance, in the example above, you can go to the about page and back. This is different from having different
versions of the app for every team.
{% /callout %}

## What was generated?

To understand how Module Federation works with Nx, let's take a look at three files that control this feature.

### `apps/host/project.json`

The `build` target uses `@nx/webpack:webpack` for React, and `@nx/angular:webpack-browser` for Angular. This is the same
as a normal SPA that uses custom webpack configuration (`webpackConfig`), but difference is in the webpack configuration
file.

If you use Module Federation to speed up your CI and improve your local development, and not to deploy different remotes
independently, you need to create implicit dependencies from the host to all the remotes. Semantically, the host and the
remotes comprise one application, so you cannot build the host without the remotes. Adding implicit dependencies also
makes distributed builds possible ([see below](#production-build-and-deployment)). To create these dependencies, add
the `implicitDependencies` configuration.

```text
// apps/host/project.json
{
  //...
  "implicitDependencies": ["about", "shop", "cart"]
}
```

In the future, Nx may automatically handle this for you.

### `apps/host/webpack.config.ts`

The webpack configuration uses an utility function that Nx provides: `withModuleFederation`.

```javascript
// For Angular, you'll see `@nx/angular/module-federation`
import { withModuleFederation } from '@nx/react/module-federation';
import moduleFederationConfig from './module-federation.config';

export default withModuleFederation({
  ...moduleFederationConfig,
});
```

We'll talk about [what `withModuleFederation` does](#what-does-withmodulefederation-do) in a bit, but for now the
important part of the configuration is the use of `module-federation.config.ts` which we will examine next.

{% callout type="note" title="Extending the Webpack Config" %}
If you find yourself needing to add additional webpack plugins to your config, you can do so by following the pattern
below. This example shows how you could use it to add the `LicenseWebpackPlugin` but you can use this method to apply
any webpack plugins you need.

```js
import { withModuleFederation } from '@nx/angular/module-federation';
import config from './module-federation.config';
import { LicenseWebpackPlugin } from 'license-webpack-plugin';
import { resolve } from 'path';

export default async function (wco) {
  const wmf = await withModuleFederation(config);
  return wmf({
    ...wco,
    plugins: [
      ...(wco.plugins ?? []),
      new LicenseWebpackPlugin({
        stats: {
          warnings: false,
          errors: false,
        },
        perChunkOutput: false,
        outputFilename: '3rdpartylicenses.txt',
        skipChildCompilers: true,
        modulesDirectories: [resolve(__dirname, '../../node_modules')],
      }),
    ],
  });
}
```

{% /callout %}

### `apps/host/module-federation.config.ts`

This file is the main configuration for the `host`, and you'll see `module-federation.config.ts` for the generated
remotes as well.

```javascript
import { ModuleFederationConfig } from '@nx/webpack';

export const config: ModuleFederationConfig = {
  name: 'host',
  remotes: ['shop', 'cart', 'about'],
};

export default config;
```

The required `name` property is the magic to link the host and remotes together. The `host` application references the
three remotes by their names.

{% callout type="note" title="More details" %}
It is important that the values in `remotes` property matches the `name` property of the remote applications. Otherwise,
webpack will throw an error. Nx handles this automatically for you so there shouldn't be an issue unless it was modified
manually.
{% /callout %}

## What does `withModuleFederation` do?

In the previous section, we saw `withModuleFederation` used in the webpack config. This function is an abstraction on
top of `@module-federation/enhanced` with some Nx-specific behavior.

- All libraries (npm and workspace) are shared singletons by default, so you don't manually configure them.
- Remotes are referenced by name only, since Nx knows which ports each remote is running on (in development mode).
- Access to the latest features of Module Federation (such as RuntimePlugins). Learn more at [module-federation.io](https://module-federation.io).

With Nx, the developer experience (DX) when working with Module Federation matches more closely to development on a SPA.
You don't have to worry about managing a bunch of configuration, and most things just work out of the box.

### Excluding or overriding shared libraries

There are cases where excluding or changing the shared configuration is required. For example, shared libraries are not
tree shaken, so to enable this behavior you must exclude them from being shared.

To exclude a library or change its configuration, you can provide
the `shared: (libraryName, sharedConfig) => sharedConfig` function in your configuration file.

```javascript
// module-federation.config.ts
import { ModuleFederationConfig } from '@nx/webpack';

export const config: ModuleFederationConfig = {
  name: 'host',
  remotes: ['shop', 'cart', 'about'],
  shared: (name, config) => {
    // We want lodash to be tree shaken, and bundled into each host/remote separately.
    if (name === 'lodash') {
      return false;
    }
  },
};
```

The `shared` function can return an `undefined` to use Nx's default value, `false` to exclude it from being shared, or
a [shared config](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints) that webpack supports.

{% callout type="note" title="Analysis" %}
The default configuration, without overrides, should work well for most workspaces, and we encourage you to analyze your
bundles before optimizing the shared behavior.

To analyze the size of your bundles, run build with `--statsJson` and use a tool
like [`webpack-bundle-analyzer`](https://www.npmjs.com/package/webpack-bundle-analyzer).

If you have any feedback regarding this feature, we'd love to hear from you--check
our [community page](/community) for links to our Discord and Twitter.
{% /callout %}

## Remote computation caching with Nx Cloud

To use Module Federation well, we recommend that you enable [Nx Cloud](https://nx.app). If you haven't enabled it yet
when using `create-nx-workspace`, create an account at [https://cloud.nx.app](https://cloud.nx.app) and connect to your repository.

With Nx Cloud enabled, a large set of builds can be skipped entirely when running the application locally (and in
CI/CD). When you run builds through Nx + Nx Cloud, the artifacts are stored in the remote cache, so as long as the
source of a given remote hasn't changed, it will be served from cache.

You can see this behavior locally if you serve the `host` twice.

```shell
nx serve host

# (kill server)

nx serve host
```

The second serve starts up much faster, because the three remotes (`shop`, `cart`, `about`) are read from cache. Not
only that, any other copy of the workspace will also benefit from the cache if they haven't changed a particular remote.
If, say, someone is working on `shop`, they will get the `cart` and `about` builds from the cache.

If you inspect the terminal output, you'll see something like this, even if you are on different machines.

```shell
> nx run about:build:development  [existing outputs match the cache, left as is]

(snip)

NX   Successfully ran target build for project about

Nx read the output from the cache instead of running the command for 1 out of 1 tasks.

```

{% callout type="note" title="More details" %}
This caching behavior is _crucial_. If you don't have a build system supporting remote computation caching, using
Module Federation will be slower. It takes longer to build `shop`, `cart` and `about` separately than building all of
them together as part of the same process.

**When using Nx, you rarely have to build all of them because most of the time you work on one remote, other remotes
will be retrieved from cache.**
{% /callout %}

This also helps things like end-to-end (E2E) testing because testing against a static server is much more efficient than
starting many servers in development mode. When the CI pipeline runs E2E tests, all the remotes should be served
statically from cache.

In addition to computation caching, Nx Cloud also comes with:

- Distributed task execution, which simplifies your CI/CD setup, and speeds up your builds.
- GitHub integration, so you can easily access important information without digging through a bunch of CI/CD logs.
- Actionable insights, which improve caching and task distribution.

![Nx Cloud run details](/shared/concepts/module-federation/nx-cloud.png)

## Production build and deployment with Nx Cloud

In this section, we'll examine how to set up your production build and simulate a deployment to `http://localhost:3000`.

First, make sure you have implicit dependencies from `host` to each remote. In case you didn't already set this up, add
the following line to the `host`'s project configuration.

```jsonc {% fileName="apps/host/project.json" %}
{
  //...
  "implicitDependencies": ["about", "shop", "cart"]
}
```

Next, open up the production webpack configuration file and update the remote URLs to their own sub-folder
under `http://localhost:3000`.

```javascript {% fileName="apps/host/webpack.config.prod.js" %}
import { withModuleFederation } from '@nx/react/module-federation';
import moduleFederationConfig from './module-federation.config';

export default withModuleFederation({
  ...moduleFederationConfig,
  remotes: [
    ['shop', 'http://localhost:3000/shop'],
    ['cart', 'http://localhost:3000/cart'],
    ['about', 'http://localhost:3000/about'],
  ],
});
```

Now you can run `nx build host` to build all the `host` and all the implicit dependencies in production mode.

{% callout type="note" title="Remote caching" %}
Again, if you don't use [Nx Cloud's Distributed Tasks Execution](/ci/features/distribute-task-execution) using Module Federation will be slower
than building everything in a single process. It's only if you enable Distributed Tasks Execution, your CI will be able
to build each remote on a separate machine, in parallel, (or not build it at all and retrieve it from cache), which will
reduce the CI time.
{% /callout %}

After running that command you'll see the following artifacts in `dist` folder.

```text
dist/apps
├── about
├── cart
├── host
└── shop
```

Now, we can add a simple deploy command to simulate deploying this folder to production.

```shell
nx g @nx/workspace:run-commands \
deploy \
--project=host \
--command="rm -rf production && mkdir production && cp -r dist/apps/host/* production && cp -r dist/apps/{shop,cart,about} production && http-server -p 3000 -a localhost production"
```

You can then run `nx deploy host` to see the application running on `http://localhost:3000`. If you inspect
the `production` folder you'll see the following files.

```text
production/
├── about
│   ├── remoteEntry.js
│   └── (snip)
├── cart
│   ├── remoteEntry.js
│   └── (snip)
├── shop
│   ├── remoteEntry.js
│   └── (snip)
├── index.html
└── (snip)
```

The above command is just an example. You'll need to use what make sense for your team and workspace.

For examples of how CI/CD pipelines can be configured using Nx Cloud and GitHub, see
our [React](https://github.com/nrwl/react-module-federation)
and [Angular](https://github.com/nrwl/ng-module-federation) examples.

{% github-repository url="https://github.com/nrwl/ng-module-federation" /%}

{% github-repository url="https://github.com/nrwl/react-module-federation" /%}

## Using buildable libs

By using Module Federation you essentially split your application build process vertically. You can also split it
horizontally by making some libraries buildable.

We don't recommend making all libraries in your workspace buildable--it will make some things faster but many other
things slower. But in some scenarios making a few large libraries at the bottom of your graph buildable can speed up
your CI.

Because Nx Cloud's Distributed Tasks Execution works with any task graph, having buildable libraries is handled
automatically. If you have a buildable `components` library that all remotes depend on, Nx Cloud will build the library
first before building the remotes.

## Summary

You could use Module Federation to implement [micro frontends](/concepts/module-federation/micro-frontend-architecture),
but this
guide showed how to use it to speed up your builds.

Module Federation allows you to split a single build process into multiple processes which can run in parallel or even
on multiple machines. The result of each build process can be cached independently. For this to work well in practice
you need to have a build system supporting remote computation caching and distributed tasks execution (e.g., Nx +
Nx Cloud).

When a developer runs say `nx serve host --devRemotes=cart`, they still run the whole application, but `shop`
and `about` are served statically, from cache. As a result, the serve time and the time it takes to see the changes on
the screen go down, often by an order of magnitude.

When a CI machine runs say `nx build host --configuration=production`, the `shop`, `about` and `cart` remotes will
either be build on separate machines or retrieved from cache. Once all of them are built, the build process for `host`
will combine the file artifacts from all the remotes. Nx Cloud takes care of distributing the tasks and moving file
artifacts across machines. As a result, the worst case scenario build time (when nothing is cached) goes from building
all the code to building the largest remote, which is often an order of magnitude faster.

## Resources

- [React Module Federation example](https://github.com/nrwl/react-module-federation)
- [Angular Module Federation example](https://github.com/nrwl/ng-module-federation)
