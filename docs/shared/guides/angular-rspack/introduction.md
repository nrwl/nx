---
title: 'Introduction - Angular Rspack and Rsbuild'
description: 'Learn how Rspack can help you speed up your Angular applications.'
---

# Introduction

Angular's compilation has always been a black box hidden behind layers of abstraction and configuration, exposed via the Angular Builders from the Angular CLI packages.

Originally, the underlying tool that bundled the Angular application was [Webpack](https://webpack.js.org). This was great as teams were able to extend their builds by leveraging the vast Webpack ecosystem and plugins that are available.

Over time, it became clear that the inherit slowness with Webpack build speeds was becoming more and more of an issue for Angular developers.

The Angular Team decided to address this build speed issue by building out a new build pipeline that leveraged [Esbuild](https://esbuild.github.io/).

This succeeded in reducing the build times for Angular applications, however, it made one crucial mistake. It left the existing Angular applications that relied on the Webpack ecosystem behind, with either a difficult migration path or none at all.

---

## Rspack and Rsbuild

The solution to this problem was to create a new build pipeline that would be able to leverage the existing Webpack ecosystem and plugins, while also providing faster builds for Angular applications.

This is where [Rspack](https://rspack.dev) and [Rsbuild](https://rsbuild.dev) come into play.

Rspack is a high performance JavaScript bundler written in Rust. It offers strong compatibility with the Webpack ecosystem, allowing for almost seamless replacement of webpack, and provides lightning fast build speeds.

Because it supports the existing Webpack ecosystem, it provides an answer to teams that maintain Angular applications using Webpack and want to migrate to a faster build pipeline.

Rsbuild is a build tool based on Rspack, however it does not support the Webpack ecosystem. It does provide out-of-the-box (OOTB) Module Federation support and a plugin system for extending the build with build speeds comparable to Esbuild.

This makes it a great solution for teams that want to migrate to a faster build pipeline, but still want the ability to easily extend their builds and use [Module Federation](https://module-federation.io).
