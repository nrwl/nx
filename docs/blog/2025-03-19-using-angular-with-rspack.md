---
title: 'Using Rspack with Angular'
date: 2025-03-19
slug: using-rspack-with-angular
authors: [Colum Ferry]
tags: [angular, webpack, rspack, nx]
cover_image: /blog/images/2025-03-19/rspack.avif
description: Learn about how and why to use Rspack with Angular thanks to Nx's efforts for supporting Rspack for Angular.
---

{% callout type="deepdive" title="Angular Week Series" expanded=true %}

This article is part of the Angular Week series:

- [Modern Angular Testing with Nx](/blog/modern-angular-testing-with-nx)
- [Angular Architecture Guide To Building Maintainable Applications at Scale](/blog/architecting-angular-applications)
- **Using Rspack with Angular**
- [Enterprise Patterns](/blog/enterprise-angular-book)

{% /callout %}

Configuring your build tooling for [Angular](https://angular.dev) applications has always been a lesser concern for most Angular developers due to the abstractions that Angular created called `builders`. The underlying implementation details were hidden from the developer who only needed to run either `ng build` or `nx build`.  
Despite this, most Angular developers knew that it was originally [Webpack](https://webpack.js.org/) that was used to build their applications. This was a great solution at the time and it was even possible to extend their builds by leveraging custom webpack configurations and plugins.

Over time, as applications grew in size and complexity, it became clear that the inherit slowness with Webpack build speeds was becoming more and more of an issue for Angular developers.

The Angular Team decided to address this issue by creating a new build pipeline that leveraged [Esbuild](https://esbuild.github.io/).

> Esbuild brought much-needed performance improvements to Angular builds, but existing Webpack-based applications were left with either a difficult migration path or no clear upgrade strategy.

To this day, many existing Angular applications still rely on Webpack because they cannot readily replace their Webpack configurations and plugins with equivalent Esbuild plugins. Thus, they are continuing to fight with slow builds reducing their productivity.

## What about Rspack?

[Rspack](https://rspack.dev) is a high performance JavaScript bundler written in Rust. It offers strong compatibility with the Webpack ecosystem, allowing for almost seamless replacement of webpack, and provides lightning fast build speeds.

Because it supports the existing Webpack ecosystem, it provides an answer to teams that maintain Angular applications using Webpack and want to migrate to a faster build pipeline.

However, it is crucial to understand that Rspack is not _completely_ compatible with the Webpack ecosystem with some slight nuances and low-level api differences that prevent certain plugins and loaders from working out of the box.

One such example is the `AngularIvyPlugin` which is a Webpack plugin that is used to support Angular's Ivy compiler. Therefore, it was not possible to simply drop in Rpsack and expect it to work with Angular applications.
Many people have tried to get Rspack working with Angular, but it has proven to be a challenge, with partial support and partial success being reported in the past but with a lot of limitations or actual performance degradations over the Webpack approach.

Previous attempts to get Rspack working with Angular focused on porting the Webpack-specific plugins, loaders and configurations to Rspack, either as-is or by reproducing them. This approach was never fully successful.

Instead, a new approach was needed to support Rspack with Angular. A closer examination of how Angular compiles and bundles the application was required.

## Introducing Angular Rspack

![Angular Rspack Logo](/blog/images/2025-03-19/angular-rspack-logo-small.avif)

Angular Rspack started in September 2024 after I spent way too long investigating and researching how exactly Angular compiles and bundles for both their Webpack support and Esbuild support.

Something that I kept coming back to was that any Rspack solution that relied too much on Angular's Webpack support had the chance of being dropped by the Angular team as they continue to build out incredible new features with Esbuild. Instead, I decided that replicating and utilizing the abstractions the Angular team provided for their Esbuild support had a much stronger chance of longevity.

But before we dive into the technical details, I am excited to announce that Angular Rspack is now being maintained by the Nx team and is available for use with Nx. This means that you can now use Rspack with Angular and Nx and enjoy the benefits of both.  
The new package is called [@nx/angular-rspack](https://www.npmjs.com/package/@nx/angular-rspack) and it is available on npm while the repository has been moved to [nrwl/angular-rspack](https://github.com/nrwl/angular-rspack).

Nx already supports and integrates with a wide variety of build tooling across the ecosystem - filling in the gaps where developer experience (DX) needs to be improved - which makes Nx the perfect fit for continuing to maintain and build out Angular Rspack.

The support is still currently experimental, however, it is in a state that may be sufficient for your current needs. We invite you to try it out and to let us know if you run into issues by raising issues on the [angular-rspack repo](https://github.com/nrwl/angular-rspack/issues/new).

There are some limitations and missing features that are currently being worked on and on the roadmap to support. They have been listed at the bottom of this article.

## Migrating from Angular Webpack to Angular Rspack

To make the migration process as smooth as possible, a new generator has been added to the `@nx/angular` package called `convert-to-rspack` which will help you migrate your Angular applications from Webpack to Rspack.

The steps are very simple:

1. Run `nx migrate latest` to update your workspace to the latest version of Nx.
2. Run `nx g @nx/angular:convert-to-rspack` to migrate your Angular application to Rspack.

There is also a [guide in our documentation](/recipes/angular/rspack/migrate-from-webpack) that walks you through the process step-by-step.
Even if you're currently using the Angular CLI, it's as simple as first running `npx nx init` in your workspace and then running `npx nx g convert-to-rspack`.

## Using Angular Rspack

You'll notice that after migrating to Angular Rspack your `build` and `serve` targets have been removed from your project, and are instead [inferred](/concepts/inferred-tasks) by the `@nx/rspack/plugin`.
In addition, a new `rspack.config.ts` file has been created in your project which looks something like this:

```ts
import { createConfig } from '@nx/angular-rspack';
export default createConfig(
  {
    options: {
      root: __dirname,
      outputPath: {
        base: '../../dist/apps/app',
      },
      index: './src/index.html',
      browser: './src/main.ts',
      polyfills: ['zone.js'],
      tsConfig: './tsconfig.app.json',
      assets: [
        './src/favicon.ico',
        './src/assets',
        {
          input: './public',
          glob: '**/*',
        },
      ],
      styles: ['./src/styles.scss'],
      scripts: [],
    },
  },
  {
    production: {
      options: {
        outputPath: {
          base: '../../dist/apps/app-prod',
        },
        index: './src/index.prod.html',
        browser: './src/main.prod.ts',
        tsConfig: './tsconfig.prod.json',
      },
    },
  }
);
```

{% callout type="deepdive" title="createConfig Information" %}
The `createConfig` function is used to create an Rspack configuration object setup for Angular applications.
You can read more about it [here](/nx-api/angular-rspack/documents/create-config).
{% /callout %}

### Building and Serving your Application

You can now run `nx build app` and `nx serve app` to build and serve your application via Rspack.

```{% command="nx build app" %}
> nx run app:build

> rspack build --node-env=production

●  ━━━━━━━━━━━━━━━━━━━━━━━━━ (100%) emitting after emit                                               browser:


  browser compiled successfully in 2.32 s
```

```{% command="nx serve app" %}
> nx run app:serve

> rspack serve --node-env=development

<i> [webpack-dev-server] [HPM] Proxy created: /api  -> http://localhost:3000
<i> [webpack-dev-server] Project is running at:
<i> [webpack-dev-server] Loopback: http://127.0.0.1:8080/
<i> [webpack-dev-server] Content not from webpack is served from '/Users/columferry/dev/nrwl/issues/rspack-angular/ng-rspack/e2e/fixtures/rspack-csr-css/public' directory
<i> [webpack-dev-server] 404s will fallback to '/index.html'
Listening on port: 8080
●  ━━━━━━━━━━━━━━━━━━━━━━━━━ (100%) emitting after emit                                               browser:
  browser compiled successfully in 2.33 s
```

### Using a configuration

To run the build with the `production` configuration:

```bash
NGRS_CONFIG=production nx build app
```

`NGRS_CONFIG` is an environment variable that you can use to specify which configuration to use. If the environment variable is not set, the `production` configuration is used by default.

## Creating a new Angular Rspack application

We currently do not have a generator for creating a new Angular Rspack application, but we will soon and it will be available under a `--bundler=rspack` option on the `@nx/angular:application` generator.

However, you can still create a new Angular Rspack application by running the following commands:

```shell
nx g @nx/angular:application myapp --bundler=webpack
nx g @nx/angular:convert-to-rspack myapp
```

## Benchmarks

![Benchmarks](/blog/images/2025-03-19/bundler-build-times.avif)

Below is a table of benchmarks for the different bundlers available, run against an application consisting of ~800 lazy loaded routes with ~10 components each - totaling ~8000 components.

**System Info**

- MacBook Pro (macOS 15.3.1)
- Processor: M2 Max
- Memory: 96 GB
- `@nx/angular-rspack` version: 20.6.2
- Angular version: ~19.2.0

| Build/Bundler | Prod SSR (s) | Prod (s) | Dev (s) |
| ------------- | ------------ | -------- | ------- |
| Webpack       | 198.614      | 154.339  | 159.436 |
| esbuild       | 23.701       | 19.569   | 15.358  |
| Rsbuild       | 23.949       | 20.490   | 18.209  |
| Rspack        | 30.589       | 19.269   | 19.940  |

> You can find the benchmarks and run them yourself: [https://github.com/nrwl/ng-bundler-benchmark](https://github.com/nrwl/ng-bundler-benchmark)

As can be seen by the benchmarks above, Rspack is significantly faster than Webpack and very close to Esbuild.

Given that the primary goal for Angular Rspack is to provide a faster build system for Angular Webpack applications while supporting their existing Webpack configurations and plugins, we are confident that Angular Rspack will be a great choice for teams that want to migrate to a faster build system.

## Known Limitations and Missing Features

The following are known limitations and missing features of Angular Rspack:

- Static Site Generation (SSG) is not supported. _**UPDATE**: As of Angular Rspack version 20.9, SSG is supported._
- Angular's built-in support for Internationalization (i18n) is not supported. _**UPDATE**: As of Angular Rspack version 20.8, i18n is supported._
- Server Routing is not supported - still experimental in Angular currently.
- App Engine APIs are not supported - still experimental in Angular currently.
- Optimization is not currently 1:1 with Angular's optimization - however, there are still great optimizations that are made. _**UPDATE**: As of Angular Rspack version 21, Optimization is 1:1 with Angular's optimization._
- Web Workers are not fully supported. _**UPDATE**: As of Angular Rspack version 20.8, Web Workers are supported._
- Hot Module Replacement (HMR) is partially supported. _**UPDATE**: As of Angular Rspack version 21, HMR is supported._

If you have any other missing features or limitations, please [let us know](https://github.com/nrwl/angular-rspack/issues/new).

## What's Next?

We are actively working on improving the experience, stability and performance of Angular Rspack. Our next steps will revolve around getting to feature parity with Angular's build system - addressing the items listed above to achieve this.

The `@nx/angular` plugin will also be updated to support generating new Angular Rspack applications as well as supporting Rspack Module Federation with Angular.

Exciting times ahead! You can follow our progress by starring the [Angular Rspack repository](https://github.com/nrwl/angular-rspack) and following us on [X](https://X.com/nxdevtools).

## Further Reading

- [Nx Angular Rspack](/recipes/angular/rspack/introduction)
- [Angular](https://angular.dev)
- [Rspack](https://rspack.dev)
- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
