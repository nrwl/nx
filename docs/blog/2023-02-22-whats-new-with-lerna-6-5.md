---
title: 'What’s New With Lerna 6.5?'
slug: 'whats-new-with-lerna-6-5'
authors: ['Zack DeRose']
cover_image: '/blog/images/2023-02-22/1*izlWzEYnkZ9myXi58Rmv8A.png'
tags: [nx, release]
---

In case you missed it, Lerna version 6.5 recently launched. We’ll catch you up on the latest Lerna news and newest features.

## Table of Contents

- [Lerna: Brought to You by Nx](#lerna-brought-to-you-by-nx)
- [Still On Lerna 4?](#still-on-lerna-4)
- [Idempotency Added to the `lerna publish from-git` Command](#idempotency-added-to-the-lerna-publish-fromgit-command)
- [`lerna run` Can Run Multiple Scripts In a Single Command](#lerna-run-can-run-multiple-scripts-in-a-single-command)
- [New --include-private Option Added To lerna publish](#new-includeprivate-option-added-to-lerna-publish)
- [Massive Refactor](#massive-refactor)
- [Getting Started With Lerna From The Lerna Team](#getting-started-with-lerna-from-the-lerna-team)
- [The Future of Lerna](#the-future-of-lerna)

## Lerna: Brought to You by Nx

In case you missed it, Lerna, the OG JavaScript monorepo tool, went largely unmaintained for a while, starting around 2020. Then, it officially declared itself to be unmaintained in April of 2022, only for Nx to step in to take over maintenance of the project in May of 2022!

You can find a more detailed account of Lerna’s “Maintainance Odyssey” in [this article](/blog/lerna-is-dead-long-live-lerna).

Since Nx took over in Lerna 4, we’ve added a brand new site to refresh the Lerna Docs:

![](/blog/images/2023-02-22/0*3GKvhzStrTwq7re5.avif)

The top of our priorities for Lerna 5 was to resolve all vulnerabilities and outdated dependencies facing Lerna. We went on to make Lerna faster by allowing users to [opt into Nx’s task caching inside of Lerna with the new `lerna add-caching` command](https://github.com/lerna/lerna/tree/main/packages/lerna/src/commands/add-caching#readme), and [add support for distributed caching to share task results amongst your organization in Lerna with Nx Cloud](https://lerna.js.org/docs/features/share-your-cache).

We were proud to go on to launch [Lerna 6](/blog/lerna-reborn-whats-new-in-v6) last October, where we began focusing on further improving Lerna’s feature set — focusing specifically on its unique strengths: versioning and publishing.

## Still on Lerna 4?

[Here’s how to upgrade to the latest and greatest](https://lerna.js.org/upgrade).

We’ve also started an initiative to assist Open Source projects in getting the most out of Lerna. Projects that use Lerna can now request free consulting to learn how to take advantage of Lerna’s newest features.

We’ve just started this initiative and have already been able to help [Sentry](https://github.com/getsentry/sentry-javascript) get optimized with task caching and task pipeline optimizations for their workspace!

![](/blog/images/2023-02-22/0*7Wu1y3L6BNPZmZwE.avif)

This initiative complements [our free tier of unlimited Nx Cloud](/pricing) for any Open Source project.

If you’re interested in optimizing your Open Source project to take advantage of the latest Lerna features, [reach out to us on Twitter!](https://twitter.com/lernajs)

Now let’s jump into the newest Lerna 6.5 features!

## Idempotency Added to the `lerna publish from-git` Command

{% youtube src="https://youtu.be/kh4TaiKbC8c" /%}

“Idempotent” is a word used to describe an operation you can perform any number of times, and the resulting state is the same as if you had only run the operation once.

The [`lerna publish` command](https://github.com/lerna/lerna/tree/main/libs/commands/publish#readme) is a beneficial tool for quickly publishing multiple packages from your workspace:

- Running `lerna publish` by itself will version and publish all packages in the workspace since your latest release
- Running `lerna publish from-git` will publish all projects tagged in the latest commit
- Running `lerna publish from-package` will publish all projects whose version does not yet exist in the target registry based on the version listed in their `package.json` file.

As we can see, `lerna publish from-package` is already idempotent (since it only publishes packages whose version doesn't exist, any run past the first will not adjust the state of the registry).

With 6.5, we’ve added the same idempotency to `lerna publish from-git`. This update is handy for recovering from a situation where some of your packages failed to publish initially (maybe due to a networking issue).

[For more information, check out the PR](https://github.com/lerna/lerna/pull/3513)

## `lerna run` Can Run Multiple Scripts In a Single Command

For 6.5, we’ve added the ability to run multiple scripts in a single `lerna run` command! Checkout this quick video demonstrating this below:

{% youtube src="https://youtu.be/Ey73CEGcVKw" /%}

Learn more [here](https://github.com/lerna/lerna/pull/3527).

## New `--include-private` Option Added To `lerna publish`

[Npm supports a `["private": true]` configuration](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#private) as a way of preventing the publication of a library that is private.

```shell
lerna publish from-git --include-private my-private-package
```

Running `lerna publish` with this new [`--include-private`](https://github.com/lerna/lerna/tree/main/libs/commands/publish#--include-private) option (as above) will strip this `"private": true` configuration from the `package.json` of the packages listed in the command.

This new option is beneficial for the use case where you’d like to run e2e for a package that will eventually be public but is currently private to prevent getting published too soon.

{% youtube src=" https://youtu.be/7TgjCk7Diks" /%}

You can find more information on this change [here](https://github.com/lerna/lerna/pull/3503).

## Massive Refactor

Unlike the other updates mentioned for 6.5, this update does not affect Lerna’s public API, but as you can see from the numbers, this was quite an undertaking:

![](/blog/images/2023-02-22/0*AKQyRtbrKzzOUdPZ.avif)
![](/blog/images/2023-02-22/0*GUSOJi5vj5fGYYj3.avif)

The result is a significant improvement to the Typescript support for Lerna’s internals and a substantial simplification of the codebase. This investment will make Lerna significantly more approachable to other would-be contributors!

Find more on this change [here](https://github.com/lerna/lerna/pull/3517).

## Getting Started With Lerna From The Lerna Team

We recently ran a live stream with [James Henry](https://twitter.com/MrJamesHenry) and [Austin Fahsl](https://twitter.com/AustinFahsl) from our Lerna team to show how to get started with Lerna, all the way through to versioning and publishing our packages to npm!

{% youtube src="https://youtu.be/HqPOoU35xzA" /%}

Check out the recap of this session above, and check out [the repo from our session on GitHub](https://github.com/ZackDeRose/for-the-lulz).

## The Future of Lerna

Looking to the future, we are targeting Q2 of 2023 for Lerna v7 (including a `--dry-run` option for both `lerna version` and `lerna publish` commands - you can catch a sneak-peak of this in James' talk from Nx Conf 2022 below!)

{% youtube src="https://youtu.be/CNdDv2MsBuw" /%}

You can find [a roadmap for all the features we plan to add in Lerna 7](https://github.com/lerna/lerna/discussions/3410) on Github!

## Lerna More!

- [🧠 Lerna Docs](https://lerna.js.org/)
- [👩‍💻 Lerna GitHub](https://github.com/lerna/lerna)
- [💬 Nx Official Discord Server](https://go.nx.dev/community)
- [📹 Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
