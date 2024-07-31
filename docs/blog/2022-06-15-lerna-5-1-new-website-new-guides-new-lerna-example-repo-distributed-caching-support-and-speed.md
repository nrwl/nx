---
title: 'Lerna 5.1 — New website, new guides, new Lerna example repo, distributed caching support and speed!'
slug: 'lerna-5-1-new-website-new-guides-new-lerna-example-repo-distributed-caching-support-and-speed'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-06-15/1*s9oVnruUc2KKd8lkkWAVxw.png'
tags: [nx, release]
---

Almost exactly a month ago we (Nrwl & the Nx team) [took over stewardship of Lerna](/blog/lerna-is-dead-long-live-lerna?sk=60349b9dc0be3ff730ad052c4cf69df3).

It has been a wild ride since then 🤯. We..

- made ourselves familiar with the codebase, improved local development and releases for testing with [Verdaccio](https://verdaccio.org/), started setting up e2e tests and tons of more improvements to the development process
- [released Lerna 5.0](https://github.com/lerna/lerna/releases/tag/v5.0.0) a couple of weeks later, with some important deprecated package upgrades and security fixes
- processed 84+ issues so far
- started experimenting to solve one of the main pain points Lerna users experience: scaling and speed.

And now, 1 month later I’m excited to announce our next release! Here’s all you need to know.

**Check out the Nx Show stream** where we talked about all the exciting news around Lerna v5 and the roadmap going forward.

{% youtube src="https://www.youtube.com/watch?v=lKCRX5Yrl8Y" /%}

## Fast Lerna Monorepos — powered by Nx

Immediately after the 5.0 maintenance release, we started looking into one of the biggest pain points we have been hearing from Lerna users: scaling & speed.

Lerna uses two open-source packages `p-map` and `p-queue` for scheduling its tasks. The industry has advanced meanwhile, though. And there are better and more efficient alternatives. Starting with v5.1 we, therefore, added a 3rd option, to use the `nx` package.

> _Note, Nx is and has always been open source following the MIT license_

Delegating task scheduling to Nx allows to speed up any Lerna workspace in the range of 2–10 times. Check out [our public benchmark](https://github.com/vsavkin/large-monorepo) which compares Lerna with other popular JS based monorepo tools.

To make Lerna faster, all you need to do is to

- install the `nx` package
- set the `useNx` property to true in `lerna.json`.

Read all about it on Lerna’s new [guide about “Running Tasks”](https://lerna.js.org/docs/core-concepts/running-tasks).

## New Community Contributions 🙌

Alongside our own fixes and features, we’ve been delighted to reignite community contributions to the Lerna codebase, including merging several existing PRs.

We were grateful to receive and merge various documentation improvements from the community, as well as some key fixes:

- [#2946](https://github.com/lerna/lerna/pull/2946) from `@feryardiant` means that there will no longer be issues with orphaned child processes on Windows when using Lerna's legacy task runners
- [#2874](https://github.com/lerna/lerna/pull/2874) from `@rix0rrr` makes Lerna much faster at checking for cyclical dependencies in large workspaces when building its internal package graph
- [#3091](https://github.com/lerna/lerna/pull/3091) from `@simon-abbott` allows Lerna to more seamlessly support v2 lock files as part of the versioning and publishing workflows

Since we took over the project, a **massive 84 issues have been closed so far** (none of which were done by any kind of automated process). We have additionally been working on some automated messaging for very old, non-upvoted issues (those without any activity of any kind since before June 2021) in order to assist with scaling our efforts to modernize the codebase and focus on what really matters to Lerna users.

## An all-new Website — powered by Docusaurus

With the latest release we also completely redesigned the website, with a brand new theme that still preserves Lerna’s spirit but presents it in a modern and fresh manner.

![](/blog/images/2022-06-15/1*0fty6NE3WI92vROGWMV4Hw.avif)

Check it out on [https://lerna.js.org/](https://lerna.js.org/).

Lerna’s new website is powered by [Docusaurus](https://docusaurus.io/), a powerful open-source engine to generate static websites, which makes writing docs a breeze. And of course, the Lerna website got dark mode now 😉.

Alongside the refreshed website, we also created a set of new guides that help you

- get started with Lerna;
- that explain the core concepts around [bootstrapping](https://lerna.js.org/docs/core-concepts/bootstrapping), [task scheduling](https://lerna.js.org/docs/core-concepts/running-tasks) and [publishing](https://lerna.js.org/docs/core-concepts/versioning-and-publishing);
- that go into more details of some new features thanks to the Nx integration like [caching](https://lerna.js.org/docs/core-concepts/computation-caching) and [distributed task execution](https://lerna.js.org/docs/core-concepts/distributed-task-execution)

Over the next couple of days, we will keep improving those initial docs and cleaning up the README files on the main Lerna repository.

## New Example Repositories

Docs are one thing, having some example repositories is usually even more helpful to get your hands-on. We are 100% with you on this one. This is why we created two new example repositories which are deeply embedded into our guides and which you can use to try out and experiment with Lerna.

- [**Lerna Getting Started example repository**](https://github.com/lerna/getting-started-example) — You can clone it and play around with it directly or use it as part of our guides to walk through some of the aspects of setting up Lerna or playing around with its new task scheduling features.
- [**Lerna and Distributed Task Execution**](https://github.com/vsavkin/lerna-dte) — We also set up a new example repository to demonstrate the power of not just using distributed caching, but distributing you task execution across various agents to drastically reduce your CI build times. Check out the repo or learn more on [our docs](https://lerna.js.org/docs/core-concepts/distributed-task-execution).

## Lerna 5 video walkthrough

{% youtube src="https://www.youtube.com/watch?v=WgO5iG57jeQ" /%}

## What’s next?

In the coming weeks, we’re going to make updates to the repository’s READMEs, integrate missing information into the new guides and streamline the content.

Here are some more things to explore:

- [Lerna 2022 roadmap](https://github.com/lerna/lerna/discussions/3140)
- follow us on [Twitter](https://twitter.com/nxdevtools) _(we’re announcing also all Lerna related things alongside our Nx twitter account)_
- subscribe to our [Youtube channel](https://www.youtube.com/nrwl_io) for new tutorials & announcements around Lerna, Nx, Monorepos and tooling

Like it? Make sure to tweet about it and let the community know 😃
