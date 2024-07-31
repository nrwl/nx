---
title: 'Speed up your Yarn Workspace with Nx'
slug: 'speed-up-your-yarn-workspace-with-nx'
authors: ['Emily Xiong']
cover_image: '/blog/images/2022-05-19/1*V2gUpSRK_LMsjWUJiFkeig.png'
tags: [nx, release]
---

If you have a Yarn workspace, you can turn it into an Nx monorepo with a simple command. Below is an example of a Yarn workspace with multiple Expo apps which we will be using to add Nx:

[

### GitHub - byCedric/eas-monorepo-example: An example monorepo for EAS or just Expo usage

### Expo apps that only use packages and aren't aware of other apps. - Node packages that may use external and/or local…

github.com

](https://github.com/byCedric/eas-monorepo-example?source=post_page-----bc7ce99a6c64--------------------------------)

For this example workspace, there are 3 Expo applications:

- managed: Expo [managed](https://docs.expo.dev/introduction/managed-vs-bare/#managed-workflow) app
- ejected: Expo [bare](https://docs.expo.dev/introduction/managed-vs-bare/#bare-workflow) app
- with-sentry: Expo managed app with `[sentry-expo](https://github.com/expo/sentry-expo)` integrated

When you run the app, each app will just have a text in the middle of the screen:

![[object HTMLElement]](/blog/images/2022-05-19/1*ZUmmlN28C0dG9I_fu1lttw.avif)
_Screenshots of 3 applications_

This blog is going to show you how to turn the above Yarn workspace to Nx.

## Why Nx?

Before we start, the first question we need to address is: why go through all the troubles to turn a working Yarn workspace to Nx? If you got a Yarn workspace, you can already share code between apps. So why Nx?
