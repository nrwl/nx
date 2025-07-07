---
title: 'Over-The-Air Updates for Super Apps with React Native, Re.Pack and Zephyr Cloud'
slug: ota-updates-with-zephyr
authors: [Colum Ferry]
tags: []
cover_image: /blog/images/2025-01-31/cover-image.jpg
description: 'Deploy React Native app updates instantly with Module Federation and Zephyr Cloud, skipping app store review processes.'
---

Module Federation is an exciting and continually evolving technology. The use cases for Module Federation have expanded from [Micro Frontends](/technologies/module-federation/concepts/micro-frontend-architecture) and [Faster Builds](/technologies/module-federation/concepts/faster-builds-with-module-federation) to also include something that should be extremely interesting for React Native users.

Thanks to the wonderful work from the [Re.Pack](https://re-pack.dev/) team at [Callstack](https://www.callstack.com/) and [Zephyr Cloud](https://www.zephyr-cloud.io/) now you can provide over-the-air (OTA) updates to your deployed native mobile apps by running a build from your laptop - without having to deal with the difficulties or time-consuming process of deploying a new binary to each of the app stores your application is deployed to.

We have an article on [**Next-Gen Module Federation Deployments with Nx and Zephyr Cloud**](/blog/next-gen-module-federation-deployment) where you can learn more about what Zephyr Cloud is and how you can leverage it to improve your deployment story with Module Federation.

In this article, we'll be discussing Super Apps and how you can achieve Over-The-Air updates to your native mobile applications with React Native and Re.Pack.

## What are "Super Apps"?

First, to help us all get familiar with terminology, Super Apps are a term commonly used in the Asian development world to signify single applications that encompass many different domains. A good example is the [WeChat](https://www.wechat.com/) app which expanded from a simple messaging service to also include payments and e-commerce systems.

Callstack use this term to define what is possible with the following stack:

- React Native
- Re.Pack
- Module Federation
- Zephyr Cloud

## How do Over-The-Air updates work?

If we consider a standard web application that uses Module Federation we usually have an architecture of the form:

It has a Consumer (Shell) and multiple Producers (Products, Cart, Checkout). Each of the producers are built independently by separate feature teams and they deploy their bundles to their own Storage Bucket or something similar.

The Consumer will fetch the Producers at runtime and load their bundles into the application that the user interacts with - as though it were a single application bundled together.

This massively improves team autonomy and iteration speed of the application - no more organization-wide code freezes to perform a release.

Super Apps take this process and workflow and provide to it native mobile applications. By using React Native and Re.Pack, Module Federation is made available to these React Native applications. From that OTA updates to the deployed application become simple.

The main binary application that is released to the app stores becomes the Consumer and each feature team can work individually on producers that are released to a storage bucket (or similar). When the application loads, it will fetch the producers and load the latest bundle for the different features within the application.

Zephyr Cloud is already known as the best-in-class solution for deploying and managing Module Federation systems and its capabilities extend to this use-case perfectly. Feature teams create a new deployment through Zephyr and tag it as the latest for that particular producer (either manually through the Zephyr Cloud Dashboard, or via a CI pipeline), and the deployed consumer handles the reset.

As Zephyr Cloud handles rollbacks and versioning of producers - hot fixes and issue remediation can happen within seconds. Load the dashboard, find the producer, rollback to previous version.

For user support this is incredible. Imagine a scenario where a user is Live Chatting with your support team about an issue - the agent contacts the dev team about the issue - the dev team rolls back to the previous working version all within a matter of minutes (Zephyr Cloud's rollbacks tend to be sub-second, but we need to account for time lost in communication). The agent can then tell the user to simply close and re-open the application. It's **incredible**.

## Where does Nx fit?

At this point, you may be asking where Nx fits into this equation. Nx has already proven itself to be the best tool for managing Module Federation setups because of the depth of information it knows about all the jigsaw pieces that comprise the application that the end-user interacts with.

While you could have multiple repositories housing each portion of the application with completely siloed feature teams, problems can very quickly arise. Feedback loops become longer, breaking changes are more easily introduced and a major concern with this particular approach for Super Apps comes from dependency management.

There are known limitations around dependency management when using React Native, Re.Pack and Module Federation. Limitations such as dependencies that rely on native code must be aligned between all portions of the application. If these were to change, a new binary deployment to the app store must be done. JavaScript dependencies _can_ differ between portions, but this also introduces risk of runtime breaking changes.

Nx mitigates these risks. With its enforcement of a [single-version policy](/concepts/decisions/dependency-management#single-version-policy) it becomes much easier to ensure that if a dependency changes _all_ portions of the Module Federation setup are marked as ["affected"](/ci/features/affected) requiring a new deployment.

Beyond just mitigating risk of changing dependencies that can cause runtime errors, Nx will also ensure your application to scale to more developers and more feature teams. With features such as [Task Caching](/features/cache-task-results) and [Task Orchestration](/features/run-tasks#defining-a-task-pipeline) developers will know when they make their changes if they are introducing regressions or breaking changes to other areas within the system faster - before it hits production.

If you sprinkle [Nx Cloud](/ci/intro/why-nx-cloud) on top - you can ensure your CI remains fast as you scale out your application through [Nx Replay](/ci/features/remote-cache#use-remote-caching-nx-replay) and [Nx Agents](/ci/features/distribute-task-execution). Increased scalability does not come with an increased maintenance cost of managing CI machines manually thanks to declarative [config files](/ci/recipes/set-up/monorepo-ci-github-actions).

You can learn more about Why to use Nx beyond Module Federation support [here](/getting-started/intro).

## Setting up a Super App with Nx

Zephyr Cloud provides a `create-zephyr-apps` package that helps streamline the process of setting up a React Native Super App.

Run the following command:

```jsx
npx create-zephyr-apps@latest
```

You will then be prompted for details for the project you want to create. Follow the choices outlined below

```jsx
│
◇   ──────────────────────────────╮
│                                 │
│  npx create-zephyr-apps@latest  │
│                                 │
├─────────────────────────────────╯
┌   Create federated applications with Zephyr
│
◇  Where should we create your project?
│  ./acme
│
◇  What type of project you are creating?
│  React Native
│
◇  Project successfully created at acme
│
◇  Problems? ─────────────────────────────────────────────────────────────────╮
│                                                                             │
│  Discord: https://zephyr-cloud.io/discord                                   │
│  Documentation: https://zephyr-cloud.io/docs                                │
│  Open an issue: https://github.com/ZephyrCloudIO/create-zephyr-apps/issues  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────╯

│
◇  Next steps. ──────────────────────────────────────────────────╮
│                                                                │
│  cd acme                                                       │
│  pnpm install                                                  │
│  rm -rf .git                                                   │
│  pnpm run build                                                │
│  Make your first commit and link it to the remote repository!  │
│                                                                │
├────────────────────────────────────────────────────────────────╯
```

Opening the created workspace in your favourite IDE, you will notice that the generated workspace already has Nx set up!

If you run `pnpm nx graph` you will see the project graph below:

![Nx Project Graph](/blog/images/2025-01-31/zc-blog-graph.jpg)

MobileHost is the main binary application while the others act as "Mini apps" that provide the federated modules for each domain/feature within the shell application.

The [README.md](http://README.md) at the root of the workspace provides a great overview of the architecture involved and the next steps for commands to be run.

You can also learn more at [React Native, Re.Pack and Module Federation](https://docs.zephyr-cloud.io/recipes/repack-mf) on the Zephyr Cloud docs. View our previous article on [handling deployments with Zephyr Cloud](/blog/next-gen-module-federation-deployment) for more step-by-step instructions on setting up your account and deploying your first build!

## Additional Resources

- [**Shaping the Future of Super Apps in React Native**](https://www.callstack.com/blog/shaping-the-future-of-super-apps-in-react-native?ref=zephyr)
- [**create-zephyr-apps Blog Post**](https://www.zephyr-cloud.io/blog/create-zephyr-apps)
