---
title: Evolving Nx
slug: evolving-nx
authors: [Jeff Cross]
tags: [nx, release]
cover_image: /blog/images/evolving-nx/thumbnail.png
---

Over the years, Nx has grown from a small 20% side project of our consulting business into a tool that empowers millions of developers worldwide and helps Fortune 500 companies ship high-quality software faster. In the last two years, we successfully transformed our consulting business into a product company, where our team can fully focus on evolving Nx and building Nx Cloud to extend Nx’s capabilities beyond local development.

This success is in large part thanks to:

- Our commitment to building Nx as MIT-licensed open-source software, supported by the incredible contributions from our vibrant Nx community.
- Close collaboration with our customers, allowing us to understand their needs and continuously improve Nx and Nx Cloud to address their demanding and complex challenges.

When we have new ideas to make Nx better, we’ve always had two options: it could be in the open source build system, or it could be in the paid cloud product, [Nx Cloud](/nx-cloud). But sometimes, there are important things we want to offer that can solve some gnarly problems for teams but don’t require them to spend months convincing their IT department to incorporate yet another cloud service. So, we decided to create a collection of non-cloud-dependent Nx add-ons in a new package called **Nx Powerpack**, which will require paid licenses to use.

## Introducing Nx Powerpack

**[Nx Powerpack](/powerpack)** — our newest product designed to elevate the Nx CLI experience for enterprise environments. Powerpack offers advanced features like self-hosted remote cache storage, code ownership for monorepos, and workspace conformance, seamlessly integrating into sealed systems with strict security requirements. It’s also designed for ease of implementation, helping enterprises bypass lengthy procurement processes and quickly access the tools they need.

> If you want to get into the technical details, we wrote a separate blog post diving deeper into the technical details: [Introducing Nx Powerpack](/blog/introducing-nx-powerpack).

Everything in Powerpack is new functionality, not previously free features that we’re now putting behind a paywall. However, this change coincides with some Nx improvements that will eventually interfere with users who were relying on our original filesystem-based implementation of local caching. We’ve completely rewritten Nx's local caching to be faster and more secure, partly by using a local database instead of checking the filesystem for artifact metadata. With this rewrite, any custom remote caches that rely on metadata reflected in the filesystem will not work as of Nx 21. This is why we decided to build an API into Powerpack to be able to connect Nx’s cache to different clouds and data sources. Now with Powerpack, teams can use an officially-supported implementation of remote caching, without needing to use Nx Cloud.

There’s a Steve Jobs quote that I think rings true with all of us at Nx:

> "I think money is a wonderful thing because it enables you to do things. It enables you to invest in ideas that don't have a short-term payback." - Steve Jobs

As Nx has grown, we’ve hired more people to make the product better. Naturally, those people want to do good work and be paid. We all show up for work to build things we’re passionate about, and solve real pain points for the millions of developers using Nx every day. Money is what enables us to keep doing what we love. So as much as Victor Savkin and I want to just build things and give them away for free, we need to balance our personal passion with what’s the best long-term decisions for Nx — the project, the community, and the company.

Like many open source projects, one of the bigger challenges to sustainability in recent years has been larger cloud products who wait for projects to become successful, and then try to capitalize on that success at the expense of the maintainers. To battle this, many open source projects have decided to make their open source licensing more restrictive, or introduce dual licenses, forcing those vendors to work with the maintainers on a fair arrangement. We think we’ve come up with a better solution for the community by introducing a new package, Powerpack, with a new commercial license, with only new functionality. **Nx itself still has one license: the MIT license.**

![Nx products and their licenses](/blog/images/evolving-nx/nx-products-licenses.avif)

### What about my open-source repo ?

Open source projects can continue to use Nx Cloud for **free** the same way they always have, and they can continue to use Nx with all its features. If you are an open-source maintainer and you want to use Powerpack, you will get a **free license**. Just reach out to us at [powerpack-support@nrwl.io](mailto:powerpack-support@nrwl.io).

## How to Get Nx Powerpack

Powerpack can be easily purchased as a one-off license and is automatically included for all existing enterprise customers. If you’re looking to purchase a license, you can [do so on this page](/powerpack).

Are you a startup? If these features make sense for your team but the cost is a concern, reach out to our support team, and we’ll work with you to find a solution that fits.

## Got Questions?

If you’re curious to learn more about these changes for Nx and how to get started, [check out our docs](/features/powerpack).

## Learn more

- [Nx Powerpack](/powerpack)
- [Blog: Introducing Nx Powerpack](/blog/introducing-nx-powerpack)
- [Docs: Powerpack features](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
