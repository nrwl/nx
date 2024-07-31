---
title: 'Nx - The fastest growing monorepo solution in the JS ecosystem'
slug: 'nx-the-fastest-growing-monorepo-solution-in-the-js-ecosystem'
authors: [' ']
cover_image: '/blog/images/2022-06-29/fnz2knrjw6ncdi40wkpc.png'
tags: [nx]
---

[Nx]() just crossed 2 million NPM downloads / week ([see @nrwl/tao package on npm](https://www.npmjs.com/package/@nrwl/tao)).
{% tweet url="https://x.com/victorsavkin/status/1541781192114143232" /%}

And these are just the public downloads which do not include all the big fortune 500 companies using Nx on a daily basis to power their teams.

But it is not just about the number of downloads, but about the growth: Nx crossed **1 million per week in January 2022** and now **2 million in June 2022**.

[![Nx growth](/blog/images/2022-06-29/7r8c8cws3cmnju1ztpvq.png)
](https://res.cloudinary.com/practicaldev/image/fetch/s--NNJVympo--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_880/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/7r8c8cws3cmnju1ztpvq.png)

At this point you might now be wondering: what is Nx and what are monorepos? Let's start with monorepos first.

## [](#what-is-a-monorepo)What is a monorepo?

The term "monorepo" is kind of misleading, but in principle it is a single (usually) Git repository hosting multiple projects. Those projects ideally form relationships among them by sharing and re-using functionality.

[![Monorepo](/blog/images/2022-06-29/1nzs89u4kit4jbcwc09u.png)
](https://res.cloudinary.com/practicaldev/image/fetch/s--FBMQcf_Y--/c_limit%2Cf_auto%2Cfl_progressive%2Cq_auto%2Cw_880/https://dev-to-uploads.s3.amazonaws.com/uploads/articles/1nzs89u4kit4jbcwc09u.png)

The advantage for developers? If done right, increased productivity by being able to directly use shared dependencies rather than going through versioning & publishing to internal registries, being able to easily run cross-cutting experiments, do a refactoring with a single PR rather than coordinating multiple releases & version updates, more visibility to other projects & greater developer mobility among teams. These are just some of the benefits.

The exact setup of a monorepo comes in different shapes, from using a single-version policy approach to colocating packages with their own `node_modules` folders and applying symlinks for sharing code.

You can learn more at [https://monorepo.tools](https://monorepo.tools).

## [](#what-is-nx)What is Nx?

The official slogan: "a smart, fast and extensible build system". Does that mean it is a replacement for Webpack, Vite, SWC or Vite? Not really! At its core Nx is rather an orchestrator that applies these tools in the most efficient way.

Monorepo support is built into Nx's DNA. You can use Nx..

**Light-weight and incrementally** by leveraging it's powerful task scheduler. This is especially interesting if you already have a yarn/npm/pnpm workspace based monorepo setup and you want to enhance its capabilities. If you happen to use [Lerna](https://lerna.js.org) you might want to [read this](https://blog.nrwl.io/lerna-5-1-new-website-new-guides-new-lerna-example-repo-distributed-caching-support-and-speed-64d66410bec7?source=friends_link&sk=fc349af13ce1935a7ca149b4f3c123c3).

Here's an example for showing the lightweight setup of Nx, by incrementally adding it to an existing Yarn workspaces monorepo:

**Using its plugin system** which comes with powerful support for Angular, React, Next, Next.js, Node and more. These plugins are more opinionated, but carefully crafted to provide the best possible developer experience and remove the burden of a manual tooling setup. Furthermore it comes with advanced features such as [automated module federation setup](/concepts/module-federation/faster-builds-with-module-federation) or [automated code migrations](https://egghead.io/lessons/javascript-update-your-nx-workspace-with-nx-migrations), a feature that is highly appreciated by large enterprises which otherwise struggle to keep their tooling up to date.

Here's an example of developing a React application using Nx's powerful plugin system:

Learn more at [nx.dev](/getting-started/intro) and on [Youtube](https://www.youtube.com/nrwl_io). You might also find this [free Egghead course interesting](https://egghead.io/courses/scale-react-development-with-nx-4038).

## [](#how-does-nx-compare-to-other-monorepo-tools-in-the-space)How does Nx compare to other monorepo tools in the space?

- Nx offers the full spectrum, allowing for an incremental and lightweight adoption to providing a more complete and preconfigured experience based on plugins. It does not just help setup a monorepo and execute tasks, but also guides developers throughout the development lifecycle.
- Nx is faster than most of the current available alternatives. [See the corresponding benchmark repository](https://github.com/vsavkin/large-monorepo)
- Nx provides the ability to distribute the execution of tasks efficiently across multiple machines, known as [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution). This is possible via [Nx Cloud](https://nx.app) and provides major performance improvements on CI.
- Nx has a particular focus on the developer experience. A dedicated [VSCode extension](https://twitter.com/NxDevTools/status/1518620884570820608) and a [beautiful terminal output](https://twitter.com/NxDevTools/status/1520085544008503298?s=20&t=usL2N8wOxuYoqBAZ7ih7ug) are just two examples for that.
- Nx is extensible, coming with its own [devkit](/extending-nx/intro/getting-started) which allows to fully customize and tailor the Nx experience to your own needs.

## [](#nx-community)Nx Community

There's a large community behind Nx which can be found at [/community](/community).

---

## [](#learn-more)Learn more

🧠 [Nx Docs](/getting-started/intro)  
👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)  
💬 [Nx Official Discord Server](https://go.nx.dev/community)  
📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)  
🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)  
🧐 [Need help with Angular, React, Monorepos, Lerna or Nx? Talk to us 😃](https://nrwl.io/contact-us)  
🛠 [monorepo.tools](https://monorepo.tools)
