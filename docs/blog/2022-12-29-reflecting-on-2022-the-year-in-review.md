---
title: 'Reflecting on 2022 — The Year in Review'
slug: 'reflecting-on-2022-the-year-in-review'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-12-29/1*J5ESi2dVo2V-kdtLJdSQqw.png'
tags: [nx]
---

As clichéd as it is to start a “year in review” post by stating how exciting the year has been… 2022 was an exciting year for Nx! In 2022 we’ve seen amazing growth in Nx usage, and in the community, we hosted our first in-person event and received our first round of funding so we can focus our efforts on making Nx and Nx Cloud better than ever.

Here are some 2022 highlights.

## Launching monorepo.tools

![](/blog/images/2022-12-29/0*3dvDD8t4xQY8N2KM.avif)

At the beginning of 2022, we saw a significant increase in the interest in monorepos, especially in the JavaScript community. Since we had a couple of years of experience in the area, we decided to launch [monorepo.tools](https://monorepo.tools/).

We wanted to make this a place where interested developers can go to get a high-level overview of what a monorepo is about, what features you should be looking for and what tools are available.

Although we kick-started the page, we reached out to all the mentioned monorepo tool maintainers and got some really good feedback and [complete PRs to add new tools](https://github.com/nrwl/monorepo.tools/pull/32).

## From 1 to 3 Million Weekly Downloads

The popularity of Nx exploded in 2022. We were at 1 million weekly downloads in January 2022, crossed 2 million by end of June, and, as this year comes to a close, we’ve exceeded 3 million! It’s incredible to see such an adoption rate, but it very much motivates us to continue our path.

![](/blog/images/2022-12-29/0*Ftd4gN7Ka81gkx8H.avif)

## Nrwl takes over Stewardship of Lerna

Lerna has been around for a long time, and it was actually the first proper solution for implementing JavaScript-based monorepos. Long before NPM/Yarn/PNPM workspaces were a thing. Lerna allowed to easily link packages locally and had first-class support for versioning and publishing monorepo packages.

Around the summer of 2020 Lerna’s development got slower and was mainly on the shoulders of a single developer, doing it in his free time. Lerna was in maintenance mode. At Nx, we added an easy transition with an automated migration script. It was only later around March 2022, that someone merged a PR stating in big letters that Lerna is deprecated and people should migrate to an alternative. Still, Lerna is pretty popular at 1.5 million downloads/week on NPM and developers loved the automated versioning and publishing flow.

We wanted to keep Lerna alive and reached out to its core maintainer [Daniel Stockman](https://twitter.com/evocateur) and offered to move it forward. Nx has been open source since the beginning which gives us a lot of experience in managing projects in the open. Furthermore, Nx was already closely aligned with Lerna’s functionality (with Lerna providing the added benefit of automated versioning and publishing). And obviously, we saw the potential of being able to easily modernize Lerna with features such as caching. So we did it! If you’re curious, we [wrote an in-depth blog post about it](/blog/lerna-is-dead-long-live-lerna?sk=60349b9dc0be3ff730ad052c4cf69df3).

Since then,

- we released [Lerna v5](/blog/lerna-5-1-new-website-new-guides-new-lerna-example-repo-distributed-caching-support-and-speed?sk=fc349af13ce1935a7ca149b4f3c123c3)
- we completely redesigned both the website and docs at [https://lerna.js.org](https://lerna.js.org/)
- we released [Lerna v6](/blog/lerna-reborn-whats-new-in-v6?sk=05bfe6160d197277daab6a14cf94f82f)
- and made upgrading a [no-brainer](/blog/upgrade-your-lerna-workspace-make-it-fast-and-modern)

## Nx Conf Lite and our first in-person Nx Conf

This year we hosted two events featuring members of the Nx Team and community: [Nx Conf Lite](https://youtube.com/playlist?list=PLakNactNC1dGmYYdDqWTMae5YiC_DRrTx), an online mini-conference held in the spring; and [Nx Conf](https://youtube.com/playlist?list=PLakNactNC1dGicwFn2Y5L9yYm7kh22wyH), in-person, in Arizona, this past fall.

Both were a huge success, and we had some fantastic in-depth talks around Nx, Lerna, monorepos and developer tooling. You can check out the recordings here:

- [Nx Conf Lite 2022](https://www.youtube.com/playlist?list=PLakNactNC1dGmYYdDqWTMae5YiC_DRrTx)
- [Nx Conf October 2022](https://www.youtube.com/watch?v=RgPOLDRTHWw&list=PLakNactNC1dGicwFn2Y5L9yYm7kh22wyH)

## Nx Funding and New Focus on Product Development

[Nrwl](/company), the company behind Nx, is fully bootstrapped. Our work is divided into roughly 80% consulting for some of the biggest companies in the world and 20% open source work on Nx and Nx Cloud.

Seeing the traction Nx got in 2022, we wanted to invest more and hence in November 2022 we raised the first round of funding of $8.6 million.

![](/blog/images/2022-12-29/0*RhkH7lAJrKLm6abn.avif)

This allows us to work mostly full-time on improving Nx and Nx Cloud. And you can see that effect already in our latest 15.3 and 15.4 releases (continue reading for that).

Here’s our official [fundraising announcement blog post](/blog/from-bootstrapped-to-venture-backed).

## Epic Releases

We had some epic releases this year. Want to get a feel for it? Just have a look at our latest [Nx 15.3](/blog/nx-15-3-standalone-projects-vite-task-graph-and-more?sk=6f924b58b80f0d46ea1d5fe02f74d8fe) and [Nx 15.4](/blog/nx-15-4-vite-4-support-a-new-nx-watch-command-and-more?sk=c5a82dc1872a1892659ceb1497e42aae) releases.

Here’s some more:

- **Improved docs** — Documentation is hard but extremely important. We invested and kept investing a lot of time in optimizing how we structure our docs to serve newcomers and expert users alike.
- **Speed** — we drastically improved the speed of Nx, making it the [fastest monorepo solution](https://github.com/vsavkin/large-monorepo) in the frontend space.
- **Improved terminal output** — It might not sound as important. But if you run a command in a monorepo it usually involves running it for potentially hundreds of projects. A decent visualization of [what’s relevant](https://twitter.com/NxDevTools/status/1520085544008503298) can make a huge difference.
- **Local plugins** — Making Nx extensible has been a key for our community adoption. But Nx plugins go beyond and can be useful even for just automating a local Nx workspace without publishing the plugin to some public registry. Check out our [docs for local plugins](/extending-nx/tutorials/organization-specific-plugin)
- **Built-in Module Federation** — We added some pretty cool support for working with Webpack module federation. That includes migrating an existing Angular or React app to MF and generating new ones, including SSR support. Explore [our docs for more details](/recipes/module-federation)
- **Massive improvements on Nx Console** — [Nx Console](/getting-started/editor-setup) exceeded 1 million installations and experienced some huge improvements. You can now [visualize the graph](https://youtu.be/ZST_rmhzRXI) from within VSCode, [autocompletion for config files](https://youtu.be/zR2abex3AtY) and [even use it with your Lerna workspace](https://youtu.be/-oPfa7zET1o).
- **Packaged-based and Integrated repositories** — There are different styles of monorepos: [package-based and integrated](/concepts/integrated-vs-package-based). Nx has been strong with integrated monorepos since the beginning. This year we made Nx a first-class citizen for package-based monorepos as well. Check out the [blog post on how to add Nx to a PNPM workspace monorepo](/blog/setup-a-monorepo-with-pnpm-workspaces-and-speed-it-up-with-nx).
- **Easy migration** — We made migrating to Nx is as easy as running `nx init`. Regardless of whether you want to add Nx [to an existing monorepo](/recipes/adopting-nx/adding-to-monorepo), [migrating from CRA](/recipes/adopting-nx/adding-to-existing-project), the [Angular CLI](/recipes/angular/migration/angular) or even [a non-monorepo project](/recipes/adopting-nx/adding-to-existing-project). [More here](https://youtu.be/KBFQZw5ynFs?t=314)
- **Standalone apps support** — Nx’s powerful generators, executors and ability to modularize a large codebase are not only valuable for a monorepo scenario. That’s the main driver why in Nx 15.3 we introduced “standalone apps”. Here’s a short video walkthrough: [https://youtu.be/qEaVzh-oBBc](https://youtu.be/qEaVzh-oBBc)
- **Vite support** — The Vite community is growing fast, and many of our users asked for an Nx plugin coming from the core team. Even though you could use Nx in a package-based monorepo with Vite already, we wanted to make it the best experience for developing React applications with Nx and beyond. Check out [our Vite docs](/nx-api/vite) for all the details.
- **Nx Watch** — Watching for changes in a monorepo (especially package-based) can be tricky or require some weird hacks involving 3rd-party packages. In Nx 15.4 we added a native `nx watch` command. See [the docs](/recipes/running-tasks/workspace-watching).

And these are just some of the highlights. Want all the details? Check out our [release blog posts](/blog?filterBy=release).

## Things to look forward to in 2023

We have some huge plans for 2023 for Nx, Nx Cloud, Lerna, and beyond. Let’s make 2023 even more epic than 2022 has been 😉.

Make sure you follow us on our socials not to miss anything. We are on [Twitter](https://twitter.com/nxdevtools), [LinkedIn](https://www.linkedin.com/company/nrwl), [Youtube](https://www.youtube.com/@nxdevtools), [TikTok](https://www.tiktok.com/@nxdevtools), and our [blog](/blog).

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/@nxdevtools)
