---
title: 'Introduction - Angular Rspack'
description: 'Learn how Rspack can help you speed up your Angular applications.'
---

# Introduction

Angular's compilation has always been a black box hidden behind layers of abstraction and configuration, exposed via the Angular Builders from the Angular CLI packages.

Originally, the underlying tool that bundled the Angular application was [Webpack](https://webpack.js.org). This was great as teams were able to extend their builds by leveraging the vast Webpack ecosystem and plugins that are available.

Over time, it became clear that the inherit slowness with Webpack build speeds was becoming more and more of an issue for Angular developers.

The Angular Team decided to address this build speed issue by building out a new build pipeline that leveraged [Esbuild](https://esbuild.github.io/).

This succeeded in reducing the build times for Angular applications, however, it made one crucial mistake. It left the existing Angular applications that relied on the Webpack ecosystem behind, with either a difficult migration path or none at all.

---

## Rspack

The solution to this problem was to create a new build pipeline that would be able to leverage the existing Webpack ecosystem and plugins, while also providing faster builds for Angular applications.

This is where [Rspack](https://rspack.dev) come into play.

Rspack is a high performance JavaScript bundler written in Rust. It offers strong compatibility with the Webpack ecosystem, allowing for almost seamless replacement of webpack, and provides lightning fast build speeds.

Because it supports the existing Webpack ecosystem, it provides an answer to teams that maintain Angular applications using Webpack and want to migrate to a faster build pipeline.

This makes it a great solution for teams that want to migrate to a faster build pipeline, but still want the ability to easily extend their builds and use [Module Federation](https://module-federation.io).

{% callout type="warning" title="Angular Rspack Status" %}

Please note that Angular Rspack support is still experimental and is not yet considered production ready. We are actively working on improving the experience and stability of Angular Rspack, and we will continue to update this page as we make progress.

{% /callout %}

## Known Limitations and Missing Features

The following are known limitations and missing features of Angular Rspack:

- Server Routing is not supported - still experimental in Angular currently.
- App Engine APIs are not supported - still experimental in Angular currently.

If you have any other missing features or limitations, please [let us know](https://github.com/nrwl/angular-rspack/issues/new).

## Benchmarks

![Benchmarks](/shared/guides/angular-rspack/bundler-build-times.png)

Below is a table of benchmarks for different bundlers, tested on an application with ~800 lazy-loaded routes and ~10 components per route—totaling ~8000 components.

**System Info**

- MacBook Pro (macOS 15.3.1)
- Processor: M2 Max
- Memory: 96 GB

| Build/Bundler | Prod SSR (s) | Prod (s) | Dev (s) |
| ------------- | ------------ | -------- | ------- |
| Webpack       | 198.614      | 154.339  | 159.436 |
| esbuild       | 23.701       | 19.569   | 15.358  |
| Rspack        | 30.589       | 19.269   | 19.940  |

You can find the benchmarks and run them yourself: [https://github.com/nrwl/ng-bundler-benchmark](https://github.com/nrwl/ng-bundler-benchmark)
