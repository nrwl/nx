---
title: 'Helping the Environment by Saving Two Centuries of Compute time'
slug: 'helping-the-environment-by-saving-two-centuries-of-compute-time'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-08-18/1*FBQVoC9YXF7wlq3dhxfQMQ.png'
tags: [nx]
---

Among the core features of Nx is the ability to save computation time by applying different strategies. Scroll to the end of the article for some more info, but first, **how much time is actually being saved?**

## How much time is being saved?

This is how much got saved so far (data from August 16th, 2022). Pretty crazy!

![](/blog/images/2022-08-18/1*pT5u_K51oZBHGll7lz5VzA.avif)

Here are the raw numbers:

- **Last 7 days:** 5 years 4 months 2 days 2 hours 32 minutes 46 seconds
- **Last 30 days:** 23 years 8 months 25 days 8 hours 57 minutes 19 seconds
- **Since the beginning of Nx Cloud:** 200 years 10 months 13 days 19 hours 37 minutes 57 seconds

## The Effect on the Environment

Calculating the CO2 emissions can be tricky. It really depends on what machines are being used to run the computation saved by Nx Cloud. We gave it a try by using [https://green-algorithms.org/](https://green-algorithms.org/).

**Last 7-day savings correspond to:**

![](/blog/images/2022-08-18/0*wtlsJfqliTPK677u.avif)

[See all the details](https://green-algorithms.org//?runTime_hour=46752&runTime_min=0&appVersion=v2.2&locationContinent=North+America&locationCountry=United+States+of+America&locationRegion=US&coreType=CPU&numberCPUs=2&CPUmodel=Xeon+E5-2683+v4&memory=4&platformType=cloudComputing&provider=aws)

**Last 30-day savings correspond to:**

![](/blog/images/2022-08-18/0*20CiOx5JE5Lr0zaU.avif)

[See all the details](https://green-algorithms.org//?runTime_hour=207462&runTime_min=0&appVersion=v2.2&locationContinent=North+America&locationCountry=United+States+of+America&locationRegion=US&coreType=CPU&numberCPUs=2&CPUmodel=Xeon+E5-2683+v4&memory=4&platformType=cloudComputing&provider=aws)

**Since the beginning of Nx Cloud:**

![](/blog/images/2022-08-18/0*BvLzgEHLCJg9_isq.avif)

[See all the details](https://green-algorithms.org//?runTime_hour=1760505&runTime_min=0&appVersion=v2.2&locationContinent=North+America&locationCountry=United+States+of+America&locationRegion=US&coreType=CPU&numberCPUs=2&CPUmodel=Xeon+E5-2683+v4&memory=4&platformType=cloudComputing&provider=aws)

## Help me out! A Primer on how Nx saves computation

Nx has various strategies to help you reduce computation time, locally and on CI. Here’s a very short overview of the strategies Nx applies with some links for further reading.

### Affected Commands

Example: Run tests only for changed projects in a given PR.

```
nx affected:test
```

[Nx affected commands](/ci/features/affected) allow you to only run commands against projects that changed with respect to a baseline. Usually, this is applied in PRs processed by your CI system. Nx analyzes the Git commits and identifies all projects that got changed with respect to a base branch (usually `main` or `master`). It then makes sure to run the given command only for those projects as well as all projects depending on them since they might be affected by the change too.

This helps save computation by reducing the set of projects that need to be processed.

### Local Computation Caching

Nx comes with a so-called [computation caching](/concepts/how-caching-works) feature. For every cacheable operation, Nx takes a set of input parameters, computes a hash and stores the result.

![](/blog/images/2022-08-18/0*MusIEMCW5NlEtaaA.avif)

Whenever a hash matches, the computation is not run, but rather the previous result is restored. This can dramatically speed up things and avoid running any computation that has already been run previously.

### Distributed Remote Caching (with Nx Cloud)

By default, the Nx computation cache is stored locally (usually within the `node_modules/.cache/nx` folder). The real benefits come from sharing it with others, that being your co-workers or CI agents.

[Nx Cloud](/nx-cloud) allows to distribute the Nx computation cache across machines.

![](/blog/images/2022-08-18/0*0uisxJ76ycdSZdA1.avif)

Connecting an existing Nx workspace to Nx Cloud can be done with

```
nx connect-to-nx-cloud
```

[More on the docs](/ci/features/remote-cache). Nx Cloud comes with [500 hours of computation time saved per month](/pricing) which is plenty for most workspaces. If you go over, you can buy more, or in the worst case, caching simply stops until the next month.

## Bonus! Lerna can do this too!!

[Nrwl](/company), the company behind Nx, recently [took over stewardship of Lerna](/blog/lerna-is-dead-long-live-lerna). Meanwhile, Lerna 5.4 just got released which features a nice integration with Nx, allowing existing Lerna users to keep using the very same commands, but still benefit from the improved task scheduling and caching abilities Nx comes with.

How to enable it? [Read more on the Lerna docs](https://lerna.js.org/docs/features/cache-tasks)

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
- 🥚 [Free Egghead course](https://egghead.io/courses/scale-react-development-with-nx-4038)
