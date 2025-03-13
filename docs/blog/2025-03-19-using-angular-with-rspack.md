---
title: 'Using Angular with Rspack'
date: 2025-03-19
slug: using-angular-with-rspack
authors: [Colum Ferry]
tags: [angular, webpack, rspack, nx]
cover_image: /blog/images/2025-03-19/angular-rspack-logo-small.png
description: Learn about how and why to use Rspack with Angular thanks to Nx's efforts for supporting Rspack for Angular.
---

Building applications with [Angular](https://angular.dev) has always been a lesser concern for most Angular developers due to the abstractions that Angular created called `builders`. The underlying implementation details were hidden from the developer who only needed to run either `ng build` or `nx build`.  
Despite this, most Angular developers knew that it was originally [webpack](https://webpack.js.org/) that was used to build their applications. This was a great solution at the time and it was even possible to extend their builds by leveraging custom webpack configurations and plugins.

Over time, as applications grew in size and complexity, it became clear that the inherit slowness with Webpack build speeds was becoming more and more of an issue for Angular developers.

The Angular Team decided to address this build speed issue by building out a new build pipeline that leveraged [Esbuild](https://esbuild.github.io/).

This succeeded in reducing the build times for Angular applications, however, it made one crucial mistake. It left the existing Angular applications that relied on the Webpack ecosystem behind, with either a difficult migration path or none at all.
To this day, many existing Angular applications still rely on Webpack because they cannot readily replace their Webpack configurations and plugins with equivalent Esbuild plugins. Thus, they are continuing to fight with slow builds reducing their productivity.

## What about Rspack?

[Rspack](https://rspack.dev) is a high performance JavaScript bundler written in Rust. It offers strong compatibility with the Webpack ecosystem, allowing for almost seamless replacement of webpack, and provides lightning fast build speeds.

Because it supports the existing Webpack ecosystem, it provides an answer to teams that maintain Angular applications using Webpack and want to migrate to a faster build pipeline.

However, it is crucial to understand that Rspack is not _completely_ compatible with the Webpack ecosystem with some slight nuances and low-level api differences that prevent certain plugins and loaders from working out of the box.
One such example is the `AngularIvyPlugin` which is a Webpack plugin that is used to support Angular's Ivy compiler. Therefore, it was not possible to simply drop in Rpsack and expect it to work with Angular applications.
Many people have tried to get Rspack working with Angular, but it has proven to be a challenge, with partial support and success being reported in the past but with a lot of limitations or actual performance degradations over the Webpack approach.

Instead, a new approach was needed to support Rspack with Angular. A closer examination and replication of how Angular compiles and bundles the application was required.

## Introducing Angular Rspack

![Angular Rspack Logo](/blog/images/2025-03-19/nx-angular-rspack-logo-small.png)

Angular Rspack started in September 2024 after I spent way too long investigating and researching how exactly Angular compiles and bundles for both their Webpack support and Esbuild support.

Something that I kept coming back to was that any Rspack solution that relied too much on Angular's Webpack support had the chance of being dropped by the Angular team as they continue to build out incredible new features with Esbuild. Instead, I decided that replicating and utilizing the abstractions the Angular team provided for their Esbuild support had a much stronger chance of longevity.

We are thrilled to announce that Angular Rspack is now being maintained by the Nx team and is available for use with Nx. This means that you can now use Rspack with Angular and Nx and enjoy the benefits of both.  
The new package is called [@nx/angular-rspack](https://www.npmjs.com/package/@nx/angular-rspack) and it is available on npm while the repository has been moved to [nrwl/angular-rspack](https://github.com/nrwl/angular-rspack).

We believe that a large portion of Angular applications still using Webpack will be able to migrate to Angular Rspack without issue.

There are some limitations and missing features that are currently being worked on and on the roadmap to support. They have been listed at the bottom of this article.

## Migrating from Angular Webpack to Angular Rspack

We have worked hard to make the migration process as smooth as possible.
A new generator has been added to the `@nx/angular` package called `convert-to-rspack` which will help you migrate your Angular applications from Webpack to Rspack.

The steps are very simple:

1. Run `nx migrate latest` to update your workspace to the latest version of Nx.
2. Run `nx g @nx/angular:convert-to-rspack` to migrate your Angular application to Rspack.

We have also created a [guide](/recipes/angular/rspack/migrate-from-webpack) that walks you through the process step-by-step.
Even if you're currently using the Angular CLI, it's as simple as first running `npx nx init` in your workspace and then running `npx nx convert-to-rspack`.

## Using Angular Rspack

You'll notice a that your `build` and `serve` targets have been removed from your project, and are instead inferred by the `@nx/rspack/plugin`.
You should also notice a new `rspack.config.ts` file in your project which looks something like this:

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

{% callout type="info" title="createConfig Information" %}
The `createConfig` function is used to create an Rspack configuration object setup for Angular applications.
You can read more about it [here](/nx-api/angular-rspack/documents/create-config).
{% /callout %}

### Build and Serving your Application

You can now run `nx build app` and `nx serve app` to build and serve your application via Rspack.

### Running a configuration

To run the build with the `production` configuration:

```bash
NGRS_CONFIG=production nx build app
```

{% callout type="info" title="NGRS_CONFIG" %}
`NGRS_CONFIG` is an environment variable that you can use to specify which configuration to use. If the environment variable is not set, the `production` configuration is used by default.
{% /callout %}

## Benchmarks

Below is a table of benchmarks for the different bundlers available, run against an application consisting of ~800 lazy loaded routes with ~10 components each - totaling ~8000 components.

Using a M3 Macbook Pro

| Build/Bundler | Prod SSR (s) | Prod (s) | Dev (s) |
| ------------- | ------------ | -------- | ------- |
| Webpack       | 348.707      | 224.226  | 234.449 |
| esbuild       | 28.509       | 24.521   | 18.719  |
| Rsbuild       | 24.690       | 20.490   | 19.675  |
| Rspack        | 19.974       | 18.239   | 16.477  |

You can find the benchmarks and run them yourself: [https://github.com/nrwl/ng-bundler-benchmarks](https://github.com/nrwl/ng-bundler-benchmarks)

## Known Limitations and Missing Features

The following are known limitations and missing features of Angular Rspack:

- Static Site Generation (SSG) is not supported.
- Angular's built-in support for Internationalization (i18n) is not supported.
- Server Routing is not supported - still experimental in Angular currently.
- App Engine APIs are not supported - still experimental in Angular currently.
- Optimization is not currently 1:1 with Angular's optimization - however, there are still great optimizations that are made.
  - Styles optimization for `inline-critical` and `remove-special-comments` are not yet implemented.
  - Inlining of fonts is not yet implemented.
- Web Workers are not fully supported.
- Hot Module Replacement (HMR) is partially supported.

If you have any other missing features or limitations, please [let us know](https://github.com/nrwl/angular-rspack/issues/new).

## Further Reading

- [Nx Angular Rspack](/recipes/angular/rspack/introduction)
- [Angular](https://angular.dev)
- [Rspack](https://rspack.dev)
- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
