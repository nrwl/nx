---
title: 'Scaffolding a new Angular Rspack Application'
date: 2025-04-14
slug: scaffold-angular-rspack-applications
authors: [Colum Ferry]
tags: [angular, webpack, rspack, nx]
cover_image: /blog/images/2025-03-19/rspack.avif
description: Learn about how to scaffold a new Angular Rspack application with Nx.
---

It is not uncommon to see [Angular](https://angular.dev) applications that rely on a custom [Webpack](https://webpack.js.org) configuration - especially in enterprise settings. These applications rely heavily on the extensibility offered by Webpack via its Plugin and Loader ecosystem.

However, building Angular applications with Webpack has historically been slow. In fact, slow builds with Webpack is something that even the wider JavaScript Ecosystem has come to expect. The result? Many new bundler options have been created to tackle the issue. Vite, Rollup, Rolldown, Esbuild, Turbopack and more.

The frustration over build performance became so great that the Angular team decided to switch to [Esbuild](https://esbuild.github.io) which has offered an incredible improvement on build speed.

The problem with Esbuild – and with the other bundler options listed above – stems from the _reason_ teams needed custom Webpack configurations in the first place. The extensibility.

While most of the bundler options that are available today offer some kind of API to extend the build process, the ability to replicate the functionality of certain Webpack plugins and loaders is either impossible or would involve a large effort to build a homebrewed solution that would need to be maintained internally over time.

That is, until [ByteDance](https://bytedance.com/en) released [Rspack](https://rspack.dev).

## Rspack

![Rspack Logo](/blog/images/2025-04-14/rspack-logo.avif)

Rspack is a high performance JavaScript bundler written in Rust. It offers strong compatibility with the Webpack ecosystem, allowing for near-seamless replacement of Webpack, while providing lightning fast build speeds.

That sounds compelling enough as it is, especially for anyone that is currently using Webpack to build their applications. You can see from the benchmark results below just _how much_ faster than Webpack it really is. You can view the benchmark details [here](https://github.com/rspack-contrib/build-tools-performance).

![Rspack Benchmarks](/blog/images/2025-04-14/rspack-benchmarks.png)

Docusaurus has even [reported that switching to Rspack has resulted in a 2x-4x faster production build](https://docusaurus.io/blog/releases/3.6#docusaurus-faster)!

However, Angular’s Webpack build pipeline proved to be an issue. It had not been possible to use Rspack as a drop-in replacement for Angular applications.

Which is why [Angular Rspack](/recipes/angular/rspack/introduction) was created.

## Angular Rspack

![Angular Rspack Logo](/blog/images/2025-03-19/angular-rspack-logo-small.avif)

Angular Rspack provides Rspack Plugins and Loaders that makes it possible to build Angular applications with Rspack.

{% callout type="note" title="Learn More" %}

You can learn more about Angular Rspack from the resources below:

- [Angular Rspack - Introduction](/recipes/angular/rspack/introduction)
- [Using Rspack with Angular](/blog/using-rspack-with-angular)

{% /callout %}

At the time of writing, Angular still supports building applications with Webpack alongside Esbuild. However, they are two different build pipelines.

Therefore, if the Angular team were to **drop support for Webpack** and remove the code from the Angular Devkit packages entirely, **Angular Rspack will continue to operate**.

- By using Rspack the majority of Plugins and Loaders used by Angular applications with custom Webpack Configurations will continue to be supported
- It does not rely on Angular’s Webpack build pipeline directly. Instead it uses the abstractions in place for the Esbuild pipeline.

From the benchmark results below, you can see the vast improvement using Angular Rspack has over sticking with Webpack. You can view the benchmark details [here](https://github.com/nrwl/ng-bundler-benchmark).

![Angular Rspack Benchmarks](/blog/images/2025-03-19/bundler-build-times.avif)

You can see that the results from Rspack are comparable to the results provided by Angular’s Esbuild build pipeline.

That said, it is worth noting that there are still currently some [known limitations and missing features](/recipes/angular/rspack/introduction#known-limitations-and-missing-features).

## Why Choose Rspack for New Projects?

Given the results above, it’s clear that migrating Angular Webpack applications to Rspack can lead to significant time savings — reducing CI durations and boosting overall developer productivity.

But at this point, you might be asking _why_ you should start a new Angular project with **Rspack** instead of **Esbuild**, especially considering that benchmarks show Esbuild is still slightly faster when building Angular apps.

Here’s why Rspack is often the better choice for new projects:

- **Speed** – While Esbuild may still win out slightly in raw benchmarks, Rspack delivers massive speed improvements over traditional Webpack — especially in large projects or CI environments. It’s fast enough to feel like a completely different experience for developers used to legacy builds.
- **Extensibility** – Rspack provides a much more extensible architecture than Esbuild. This allows teams to customize and fine-tune their build processes far more effectively. For projects that have complex build requirements or need to integrate custom tooling, this flexibility is a major advantage.
- **Compatibility** – Rspack is designed to be highly compatible with the existing Webpack ecosystem. This means many plugins and loaders that teams already rely on can continue to work with minimal or no changes. It eases the migration path and preserves your existing investment in tooling and configuration.
- **Micro-frontend support** – If you're building applications that rely heavily on **[Module Federation](https://module-federation.io)**, Rspack is the clear winner. Its compatibility and support for advanced use cases in micro-frontends are significantly more mature than what's possible with Esbuild.
- **Chunking control** – Esbuild has a long-standing [issue](https://github.com/angular/angular-cli/issues/27715) with generating an excessive number of chunks, offering very limited control over how chunking is performed. This can cause performance issues in certain scenarios. In contrast, Rspack offers fine-grained chunking strategies that let teams precisely shape how their bundles are produced.

These advantages make Rspack not just a performance play, but a more adaptable and production-ready solution for modern Angular projects.

## How to Scaffold a New Angular Rspack Project?

Nx provides two methods for creating a new Angular Rspack project, one for existing Nx Workspaces and one for new Workspaces.

### New Workspaces

To create a new Nx Workspace with an Angular Rspack project run the following command and select the options listed below:

```{% command="npx create-nx-workspace myorg" path="~/" %}

NX   Let's create a new workspace [[https://nx.dev/getting-started/intro](https://nx.dev/getting-started/intro)]

✔ Which stack do you want to use? · angular
✔ Integrated monorepo, or standalone project? · integrated
✔ Application name · myorg
✔ Which bundler would you like to use? · rspack
✔ Default stylesheet format · css
✔ Do you want to enable Server-Side Rendering (SSR)? · No
✔ Which unit test runner would you like to use? · vitest
✔ Test runner to use for end to end (E2E) tests · playwright
✔ Which CI provider would you like to use? · skip
✔ Would you like remote caching to make your build faster? · skip

NX   Creating your v20.8.0 workspace.

```

### Existing Workspaces

In existing Nx Workspaces, ensure you are on Nx version `20.8.0` or greater and simply run:

```

npx nx g @nx/angular:app myapp --bundler=rspack

```

### Converting an Existing Angular Webpack Application

If you have an existing Angular Webpack application you can easily migrate it to use Angular Rspack by using the `@nx/angular:convert-to-rspack` generator. The [Migrate Angular with Webpack to Rspack](/recipes/angular/rspack/migrate-from-webpack) guide explains more on this.

## Future Work

It’s been great to see the progress on Angular Rspack so far, but it’s not done yet. We’ll be working on making it closer to feature parity with the Angular CLI by addressing:

- Internationalization (i18n) support
- Static Site Generation (SSG) support
- and more!

Stay tuned to our socials to stay up to date on the latest Angular Rspack news!

- 🧠 [**Nx Docs**](/getting-started/intro)
- 👩‍💻 [**Nx GitHub**](https://github.com/nrwl/nx)
- 💬 [**Nx Official Discord Server**](https://go.nx.dev/community)
- 📹 [**Nx Youtube Channel**](https://www.youtube.com/@nxdevtools)
