---
title: 'Rspack — Getting up to speed with Nx'
slug: 'rspack-getting-up-to-speed-with-nx'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2023-03-10/1*fWQ53mw2itEs3SGAOJVonQ.png'
tags: [nx]
---

At Nx, we are excited to see the JavaScript tooling ecosystem evolve, particularly when it comes to improving speed! Performance is at the core of Nx. Faster tools with which we can integrate make our lives easier and allow us to provide a better experience for developers.

Almost a year ago [ByteDance](https://www.bytedance.com/) started developing a new, faster Webpack alternative: **Rspack**. [Valor Software](https://valor-software.com/) joined the collaboration and reached out to us about developing a dedicated Nx plugin. The goal: give developers an easy onboarding path to Rspack and React!

## Faster than Webpack? What is Rspack?

Rspack is a rewrite of Webpack with the primary goal of improving performance. Rust is the main language, allowing for a highly parallelized architecture that takes full advantage of modern multi-core CPUs. In addition, it also comes with essential bundling features already built-in to avoid further bottlenecks from 3rd-party packages. It also highly optimizes HMR (Hot Module Replacement) using a specialized incremental compilation strategy.

ByteDance developed Rspack to solve performance issues they faced when developing and maintaining their internal monolithic applications, all of which rely heavily on complex Webpack configurations. Rspack being a rewrite allows to rely on Webpack’s mature architecture and is, at the same time, an easy drop-in replacement.

ByteDance already applied Rspack on some of their internal business applications and has seen between 5 to 10x improvement in compilation performance.

More on the official Rspack docs: [https://rspack.dev](https://rspack.dev/)

## Getting up to speed with Rspack & Nx!

Our goal at Nx is to be the best CLI for your framework of choice. We want to remove friction so developers can easily leverage these new tools and focus on shipping features using a production-ready setup. This is why we developed a dedicated Rspack plugin that lets everyone quickly get up to speed.

Check out the following video for a complete walkthrough of how Nx and Rspack work together to create production-ready React applications.

{% youtube src="https://youtu.be/jGTE7xAcg24" /%}

## React Standalone App with Rspack

You can create a new Rspack-based React application using the following command:

```shell
npx create-nx-workspace myrspackapp --preset=@nrwl/rspack
```

This creates a pre-configured setup with React, TypeScript, ESLint, Jest (optionally Vite), Cypress for e2e testing, and obviously Rspack as the bundler.

All the usual Nx features, such as

- [affected commands](/ci/features/affected)
- [computation caching](/features/cache-task-results)
- remote caching with [Nx Cloud](/nx-cloud)

..work out of the box.

But not just the “speed features”. All the code generators, automate code migrations, and [code editor extensions](/getting-started/editor-setup) work too.

## Rspack in an Nx Monorepo

Similarly, you can use Rspack-based applications in existing Nx monorepos. Just install the NPM package:

```
npm i @nrwl/rspack -D
```

Then generate a new application:

```shell
npx nx g @nrwl/rspack:app myrspackapp
```

This creates a new application in your Nx monorepo that uses Rspack as the bundler. You can even import existing React libraries, which can also be an excellent way to experiment with Rspack in an existing production setup.

## Wrapping up

Go and learn more on the

- official Rspack website: [https://rspack.dev](https://rspack.dev/)
- learn about the Nx Rspack plugin: [/nx-api/rspack](/nx-api/rspack)

## Learn more

- 🦀 [Rspack and Nx docs](/nx-api/rspack)
- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
- 🚀 [Speed up your CI](/nx-cloud)
