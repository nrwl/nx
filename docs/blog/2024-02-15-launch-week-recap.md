---
title: Launch Nx Week Recap
slug: 'launch-nx-week-recap'
authors: [Zack DeRose]
cover_image: '/blog/images/2024-02-15/featured_img.png'
tags: [nx, nx-cloud, releases, changelog]
---

We just finished wrapping up [Launch Nx Week](/launch-nx), which ran from February 5–9, including a full conference on Thursday!

In this article, we’re going to recap all the things launched during Launch Nx Conf, as well as all the talks given during the conference! Here’s a set of links so you can fast-forward to the stuff you’re most interested in if you want!

**Prefer a video?**

{% youtube src="https://www.youtube.com/embed/Ed1ZCNqWF1Q?si=m8LRyeJy_ZbCODJP" title="Launch Nx Week Recap" /%}

---

- [Nx 18.0 && Project Crystal](#nx-180-project-crystal)
  - [Project Crystal — By Juri Strumpflohner](#conference-talk-project-crystal)
  - [Project Crystal + .NET in Action — By Craigory Coppola](#conference-talk-project-crystal-net-in-action)
- [New Plugin: @nx/nuxt](#new-plugin-nxnuxt)
- [Nx Agents](#nx-agents-launched)
  - [Nx Agents Walkthrough: Effortlessly Fast CI Built for Monorepos — By Rares Matei](#conference-talk-nx-agents-walkthrough-effortlessly-fast-ci-built-for-monorepos)
  - [Solving E2E Tests — By Altan Stalker](#conference-talk-solving-e2e-tests)
- [Tusky](#tusky)
- [Nx Release](#nx-release-is-stable)
  - [Releasing Nx Release — By James Henry](#conference-talk-releasing-nx-release)

## Nx 18.0 && Project Crystal

Exciting news!! We’ve broken our standard release cadence of publishing a new major version every 6 months to release Nx 18, just 3 months after releasing Nx 17 in December 2024.

Juri announced launched Project Crystal with this video:

{% youtube src="https://www.youtube.com/embed/Ed1ZCNqWF1Q?si=m8LRyeJy_ZbCODJP" title="Nx Project Crystal" /%}

The short version is: Nx project crystal means Nx plugins make your codebases work more seemlessly with less config.

For the long version, checkout this blog post by Juri where he describes [how Nx plugins are now more like VsCode Extentions](/blog/what-if-nx-plugins-were-more-like-vscode-extensions)!

And don’t miss our two conference talks on this subject:

### Conference Talk: Project Crystal

**Speaker:** [Juri Strumpflohner](https://twitter.com/juristr) | [slides](https://drive.google.com/file/d/1q6M0drdssU7Zb-4Y_f99fuupuOl1KYQN/view)

{% youtube src="https://www.youtube.com/embed/PzCgpM7qtTU?si=U5aEC7XjeS1NeKbT" title="Juri Conference Talk Project Crystal" /%}

### Conference Talk: Project Crystal + .NET in Action

**Speaker:** [Craigory Coppola](https://twitter.com/enderagent) | [slides](https://docs.google.com/presentation/d/1uveIe6HB7xwSkh7FBGZfF8Unh5YZzm5X/edit?usp=sharing&ouid=109667724870581513512&rtpof=true&sd=true) | [example repo](https://github.com/AgentEnder/nx-launch-conf-demos)

{% youtube src="https://www.youtube.com/embed/fh-yzOuQGE8?si=a-XRXJfaBCerz3i-" title="Craigory Conference Talk Project Crystal + .Net" /%}

## New Plugin: @nx/nuxt

On Tuesday we launched our newest plugin, and our first plugin to be :gem:crystalized:gem: from it’s very beginning: @nx/nuxt!

Zack explains Nuxt and how to use the new plugin in this video:

{% youtube src="https://www.youtube.com/embed/1L-bDvEemoc?si=wHQvuTDfXFs3vjaC" title="Zack explaining new plugin @nx/nuxt" /%}

To add @nx/nuxt to your codebase, use the command:

```shell
nx add @nx/nuxt
```

Huge thanks to [Katerina](https://twitter.com/psybercity) for her work on the plugin, and Nuxt maintainer, [Daniel Roe](https://twitter.com/danielcroe), for helping to guide the project!

Zack, Katerina, and Daniel got together to live code a working tic-tac-toe app using the new Nuxt plugin and [partykit](https://www.partykit.io/) in this livestream:

{% youtube src="https://www.youtube.com/embed/uHwUxFYX2DY?si=lyYg3XPIx688k8HY" title="@nx/nuxt with Nuxt maintainer, Daniel Roe!" /%}

## Nx Agents Launched

Nx Agents are here!! We launched Nx Agents on Wednesday, and it climbed into the top 20 on [Product Hunt](https://www.producthunt.com/products/nx-cloud#nx-agents)!

We’re very excited about Nx Agents because we think that in its current state, Continuous Integration/Deployment is broken, and we think that Nx paired with Nx Agents fixes Continuous Integration. Zack explains more in this video:

{% youtube src="https://www.youtube.com/embed/_FSHQIwITic?si=jDpwTVXLYFXiHEm0" title="Nx Agents" /%}

Be sure to also checkout the [blog post from Isaac on Nx Agents](/blog/fast-effortless-ci), including explanations of exclusive features like auto-detection and retrying for flaky tasks and automatically splitting lengthy end-to-end tests!

You can find out [more of the details in our docs](/ci/features/distribute-task-execution)!

Rares and Altan are on the team building Nx Cloud, and during the conference, they dove deeper into some of these topics:

### Conference Talk: Nx Agents Walkthrough: Effortlessly Fast CI Built for Monorepos

**Speaker:** [Rares Matei](https://twitter.com/__rares) | [slides](https://drive.google.com/file/d/1k-cGCJUMP4axcCWoeih8n3dvo1oO_i_X/view?usp=sharing) | [example repo](https://github.com/rarmatei/shops-workflows/pulls) | [failed runs example](https://cloud.nx.app/cipes/65b27cf6d3ef5934decad746?utm_source=pull-request&utm_medium=comment) | [nx agents full run](https://cloud.nx.app/cipes/65b38179d3ef5934dede74c2?utm_source=pull-request&utm_medium=comment)

{% youtube src="https://www.youtube.com/embed/XS-exYYP_Gg?si=skZTGYPEVJG7BrYZ" title="Nx Agents Walkthrough" /%}

### Conference Talk: Solving E2E Tests

**Speaker:** [Altan Stalker](https://twitter.com/StalkAltan)

{% youtube src="https://www.youtube.com/embed/EO_tGa0Nx1s?si=3AvGaJkJaCeEjz1r" title="Solving E2E Tests" /%}

## Tusky

Thursday, we had a surprise announcement for our newest product on Nx Cloud: Tusky.

{% youtube src="https://www.youtube.com/embed/Xfvv09wSoM8?si=jnzyLHtdWBLwx_U0" title="Tusky" /%}

Tusky is an Artificial Intelligence for your codebase, and it will be available on Nx Cloud soon — starting in Spring of 2024.

In the teaser video, you can see some ways Tusky will be integrated into Nx Cloud to provide explainations on failed tasks, or cache misses.

The more exciting features of Tusky though includes the ability to perfectly optimize the number of agents used per PR — even spinning up and tearing down agents mid-pipeline! This is a huge optimization for task distribution, and will help optimize both walltime of your CI, as well as compute costs!

Tusky will also be able to provide organizational-level insights to your codebase, including automatically detecting development groups (like lines of business) inside your codebase based on commit history, and providing statistical insights on their commit patterns. We’re also excited about Tusky being able to make suggestions on things you can do to further optimize your codebase — like generating a PR to introduce [Codeowners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) to the repo!

## Nx Release Is Stable

Versioning and publishing packages is always a bit tricky. Mix in the added complexity of having multiple packages — sometimes with different versioning or publishing strategies — inside the same codebase, and things can get weird quick!

For a long time, Nx has been purposefully versioning and publishing agnostic, but given our time spent as [stewards of Lerna](/blog/lerna-is-dead-long-live-lerna) (the OG Javascript monorepo tool), we’ve been able to take alot of that experience and finally feel confident creating our own versioning and publishing implementation.

Therefore, we’ve been working on a new command to the Nx CLI: [nx release](/recipes/nx-release/get-started-with-nx-release#get-started-with-nx-release). We launched this on Friday of our Launch Nx week!

Juri goes into [full details in this blog post](/blog/versioning-and-releasing-packages-in-a-monorepo), and James Henry — our Director of Engineering and the primary engineer responsible for both maintaining Lerna and creating Nx Release — expands further in his conference talk:

### Conference Talk: Releasing Nx Release

**Speaker:** [James Henry](https://twitter.com/MrJamesHenry) | [example repo](https://github.com/JamesHenry/nx-release-cmd)

{% youtube src="https://www.youtube.com/embed/KjZKFGu3_9I?si=83DjaHhpBSP7NP4n" title="Releasing Nx Release" /%}

## Wrapping up

Juri, Zack, and Victor wrapped up the week with a livestream recapping the launches from the week — including answering your questions live:

{% youtube src="https://www.youtube.com/embed/xjLrFvEcxZw?si=O70JD4NgseP0lknA" title="Launch Nx Week Wrap Up" /%}

That’s all for now folks! We’re just starting up a new iteration of development on Nx, so be sure to subscribe to [our YouTube channel](https://www.youtube.com/@nxdevtools) to get updates when new features land! Until next time, KEEP WORKING HARD!

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
