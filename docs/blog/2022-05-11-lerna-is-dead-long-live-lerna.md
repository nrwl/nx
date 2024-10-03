---
title: 'Lerna is dead — Long Live Lerna'
slug: 'lerna-is-dead-long-live-lerna'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-05-11/1*__gtsrJ-tMDZf9bvDLVSjQ.png'
tags: [nx]
---

If you’re in a hurry, here’s the **TL;DR:**

> _We,_ [_Nrwl_](/company)_, the company behind Nx, are taking over the stewardship of Lerna.js, the popular JS monorepo tool._ [_Here’s the official announcement on the Lerna repo_](https://github.com/lerna/lerna/issues/3121)_. We are thrilled and committed to helping the Lerna community move forward!_

## Who is Nrwl?

We (Nrwl) are the company behind Nx ([GitHub](https://github.com/nrwl/nx)) and we have been founded by two ex-Googlers and Angular core team members [Jeff Cross](https://twitter.com/jeffbcross) and [Victor Savkin](https://twitter.com/victorsavkin). Experiencing a large-scale monorepo in action at Google, gave them a lot of insights into the advantages and productivity gains for software teams as well as the features and tooling support that is required to make monorepos work, especially at a large scale. When they left Google, they decided to bring such a tool to the masses, but with a clear goal of

- building it in the open as an open-source product and
- making it approachable and easy to use by focusing on great DX

This is when Nx started.

We think we are the best fit for helping the Lerna community continue and thrive because we have a good combination of real-world experience with open source community work. As part of Nrwl, we work with some of the world’s biggest companies, helping them improve productivity and ship great quality software through monorepos. In addition, Jeff and Victor have a lot of knowledge of managing a big open source project such as Angular when they were at Google and obviously at Nrwl from managing Nx as an open-source project with its quickly growing community.

Long story short, Nrwl ❤️ open source and community work, and we are thrilled to work with the Lerna community!

## What’s the story about Lerna being dead?

_(Spoiler: It is not dead, we took over stewardship_ 😀*. But apart from that, here’s the whole story)*

- August 2020 — Issue is being opened [mentioning that Lerna is largely unmaintained](https://github.com/lerna/lerna/issues/2703)
- April 2022 — A [PR gets merged](https://github.com/lerna/lerna/pull/3092) that properly highlights the fact of Lerna being unmaintained at the very top of the repository README. This made the “Lerna is dead” discussions flare up again.
- May 2022 — Lerna got resurrected: Nrwl takes over

While that last PR didn’t really change the fact that Lerna has been in that state for the past years already, it just made it more apparent and also how many still rely on Lerna today.

And this is not to blame its contributors at all. They did an amazing job. However, Open Source can be a tough place, especially if it is not backed by a large community and/or company that helps make the work sustainable in the long run. Taking the weight of maintaining such a widely used tool, and then mostly for free, is a huge one. Burnout is real folks, so take care. And we’ve had lots of such open-source examples in the past years.

## Nrwl is taking over: now what?

Lerna has definitely pioneered the JS monorepo space, however, the tooling space has progressed a lot in recent years. Some of its features are now baked into NPM, YARN, PNPM, and Lerna [lacks many other important monorepo features](https://monorepo.tools/#tools-review) such as computation caching to mention one example.

Nx can fill in many of these gaps. When the first discussions about Lerna being unmaintained came up in 2020, we implemented a set of features, allowing for easy migration from [Lerna/NPM/Yarn/PNPM workspaces to Nx](/recipes/adopting-nx/adding-to-monorepo). In addition, some recent [improvements in Nx](/blog/nx-v14-is-out-here-is-all-you-need-to-know) make this even easier, allowing it to basically co-exist in any of these workspaces. This can be done for instance by leveraging [Nx’s powerful task scheduling capabilities](/getting-started/intro) while still continuing on relying on Lerna’s publishing process. Maintaining now both projects, Lerna & Nx, puts us in the unique position of allowing us to work on some seamless integration between the two.

With Nx, we are known to have a clear roadmap shared with the community of what our next 6 months’ focus will be (here’s an [example of our roadmap for v15](https://github.com/nrwl/nx/discussions/9716)). As we get our hands dirty on Lerna’s codebase in the coming weeks, we are going to define a set of action items, prioritize them and elaborate a proper roadmap as well, which we will share with the community as soon as we have a more concrete plan. Since we know many organizations still depend on Lerna or may not be able to migrate away soon, some of our immediate to mid-term actions will be to **provide critical bug fixes and security updates to the project** and regularly release those to NPM.

## Stay tuned for more!

We think Lerna’s and Nx’s future is bright and we are excited to help move the monorepo space forward, more than ever before!

Make sure you don’t miss anything by

- Following us [on Twitter](https://twitter.com/NxDevTools)
- Subscribing to our [YouTube Channel](https://youtube.com/nrwl_io?sub_confirmation=1)
- Subscribing to [our newsletter](https://go.nx.dev/nx-newsletter)!

✌️
