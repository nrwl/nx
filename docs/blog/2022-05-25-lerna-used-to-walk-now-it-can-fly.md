---
title: 'How Lerna just got 10x faster!'
slug: 'lerna-used-to-walk-now-it-can-fly'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-05-25/1*WPGHapKqT3IguWjeN5UgWg.png'
tags: [nx]
---

**_TL;DR:_** _We released a new beta version of Lerna and it happens that it is now 5.3 times faster than Turbo 👀…by turning on a flag. Keep reading to learn more._

> _ICYMI: A couple of weeks ago we (Nrwl) announced that we take over stewardship of Lerna. Read all about it in our_ [_recent blog post_](/blog/lerna-is-dead-long-live-lerna)_.  
> We also just released Lerna v5 as a first maintenance release:_ [_Read more here_](https://github.com/lerna/lerna/releases/tag/v5.0.0)_._

For folks that want to migrate to Nx, we always had a dedicated [Nx and Lerna](/recipes/adopting-nx) docs page that shows you how you can easily integrate the two. However, we felt we could do better and allow you to get all the speed benefits that come from Nx’s task scheduling abilities, without needing to change nearly anything in your Lerna workspace.

And it got fast, like really fast!!

## Want the video walkthrough of Lerna 5?

Here you go

{% youtube src="https://www.youtube.com/watch?v=WgO5iG57jeQ" /%}

## How fast is it?

We just published Lerna v5.1 which introduces a `useNx` flag. Adding that makes Lerna to be on par with Nx in terms of speed, and is significantly faster than other tools.

Comparing Lerna with and without the flag isn’t really an apples-to-apples comparison because one comes with caching abilities, while before, Lerna didn’t have that at all. But just to give you an idea: enabling Nx on your existing Lerna workspace can **speed it up in the range of 2–10 times**, depending on the repo setup.

But let’s do some more real “apples-to-apples” comparison of Lerna’s speed with `useNx` enabled. For benchmarking Nx we have set up a repo in the past which we regularly use to measure the speed of new Nx releases with other similar tools on the market such as [Lage](https://microsoft.github.io/lage/) and [Turborepo](https://turborepo.org/): [https://github.com/vsavkin/large-monorepo](https://github.com/vsavkin/large-monorepo). We now added Lerna+Nx (Lerna with `useNx` enabled) to that repo to measure the impact.

Here’s a gif of running the benchmark of Lerna+Nx and Turborepo:

![](/blog/images/2022-05-25/1*MrhEU4wPZlwp4dbKsj876g.avif)

**Lerna+Nx is 5.3 times faster** than Turborepo 🚀.

As always, you can reproduce the benchmark by yourself by going to the [benchmark repo](https://github.com/vsavkin/large-monorepo). The readme includes all the details on how to run it on your own machine. We verified it in detail, but if for some reason we got something wrong, please reach out!

## What do I need to do to upgrade?

First of all, upgrade to Lerna v5.1. That release comes with the ability to delegate task running to Nx. Next you need to add Nx as a dependency: `npm i nx --save-dev`

Finally, add the following to your `lerna.json`.

```json5 {% fileName="lerna.json" %}
{
  ...
  "useNx": true
}
```

That’s mostly it. You can continue using the usual Lerna commands, but at this point Lerna would delegate its operations to Nx underneath.

To get more out of it, you might want to create a small `nx.json` file (or run `npx nx init` to generate one) for going into some more details on configuring the cacheable operations:

```json5 {% fileName="nx.json" %}
{
  extends: 'nx/presets/npm.json',
  tasksRunnerOptions: {
    default: {
      runner: 'nx/tasks-runners/default',
      options: {
        cacheableOperations: ['build'],
      },
    },
  },
}
```

Note that `useNx` is opt-in and set to `false` by default. Also, if someone is worried about the license, Nx has been open source from the very beginning, using the MIT license.

## How does this work under the hood?

So how does this work on a technical level. So far Lerna (`lerna run` to be more specific) has been delegating the task scheduling to `p-map` or `p-queue`. Meanwhile though, the industry has advanced and tools like Nx are much more powerful and efficient in their task orchestration and in addition also support caching.

With the change we made in Lerna 5.1 we are adding Nx (MIT licensed) as a third option in addition to the already existing `p-map` and `p-queue`. By having `nx` installed and configured (as mentioned in the previous section), Lerna can now delegate its `lerna run` command to Nx directly. All of this is done in a backwards-compatible way: every `lerna run` command will work but will be significantly faster and can optionally even be distributed across multiple machines without any config (more about that in the next section).

## What’s more?

By having Nx integrated, you not just get faster builds but also some other Nx’s features for free!

[**Nx Project graph**](/features/explore-graph) — By running `npx nx graph` you get the visualization of the graph. You can interactively explore what your workspace looks like and the relationships between the packages. We actually used this same graph on the Lerna repo itself, which helped us to get a better understanding of how the repo is structured when we took over the maintenance. Here’s an example of filtering the lerna packages to understand what `@lerna/exec` is about and how it relates to other packages in the repo.

![](/blog/images/2022-05-25/0*uW4TaZQy7smwCDEj.avif)

**Distributed caching** — Right now when you enable `useNx` in your existing Lerna repo, you will get local caching, meaning the cache sits in a local folder on your machine. You get much more value out of it when you start distributing and sharing it with your teammates but especially in CI. This can be done by adding Nx Cloud, which comes with a no-credit card, 500 hours free / month offer which is more than what most workspaces need. Adding that is easy and can be done by adding `@nrwl/nx-cloud` to your root-level `package.json` and then by running:

```shell
npx nx connect-to-nx-cloud
```

**Distributed task execution** — Distribution of the cache is one thing, but the real speed improvements come from also [distributing the task execution](/ci/features/distribute-task-execution) to speed up your CI. Having the Nx project graph and as well as the cache and historical data about previous runs, Nx Cloud DTE is able to maximize the CI agent utilization by evenly distributing tasks based on their (historical) duration as well as based on their topological order. In addition, the DTE process makes sure to properly move cached assets between the agents. Setting up DTE is straightforward, read more on our [Nx Cloud docs](/ci/features/distribute-task-execution). Hint: we also have a CI generator in Nx (you need the `@nrwl/workspace` package) that allows you to generate your CI setup using a single command: `npx nx generate @nrwl/workspace:ci-workflow --ci=github`

**Lerna roadmap** — We also just published a roadmap of the next steps for the Lerna repository. Check it out here: [https://github.com/lerna/lerna/discussions/3140](https://github.com/lerna/lerna/discussions/3140)

## Conclusion

This is the first beta which we are trying out on some projects already. We aren’t worried about task orchestration, caching or distribution — all of those are done by Nx, which has been around for 5 years and is solid. We are trying to see if there is something in the integration that is confusing. We hope to release s stable version by mid-June.

Please have a look, upgrade your repo and [open an issue](https://github.com/lerna/lerna/issues) if you run into some weird behavior with the new `useNx` enabled. But not only that, feel free to ping us on the [@NxDevTools](https://twitter.com/nxdevtools) account with your success stories too. We'd love to hear 😃.
