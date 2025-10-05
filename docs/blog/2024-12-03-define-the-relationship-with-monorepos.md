---
title: Define the relationship with monorepos
slug: define-the-relationship-with-monorepos
authors: ['Philip Fulcher']
tags: [nx]
cover_image: /blog/images/2024-12-03/header.avif
description: Discover how monorepos strengthen project relationships through code colocation, enabling faster iterations and better maintainability.
---

A monorepo might sound like a big, intimidating thing, but we're going to break it down to just the bare essentials. **A monorepo helps you better manage the relationships that already exist between your projects.** Once we understand those relationships, we can use tools to very quickly define them and pull them together into a more cohesive whole.

## So, what is a monorepo?

Let's start with the big question: what even is a monorepo?

> That's like when Google only has one repo for the entire company, right?

Not quite. That scale of monorepo doesn't work for most organizations, and we can still use a monorepo approach for smaller systems.

> So it's when you throw all your code in one repo and figure out how to manage it later?

This is also a pretty bad idea. We need tools and processes to manage this volume of code in a single repo.

The best definition I've seen comes from [monorepo.tools](https://monorepo.tools):

> A monorepo is a single repository containing multiple distinct projects with well-defined relationships.

Let's dig into that last part. What do we mean by **well-defined relationships?** It's useful to stat thinking about relationships between code in terms of distance.

## The shortest distance: importing from another file

We'll start with the smallest possible distance between two pieces of code: importing something from another file.

![Diagram showing a form component depending on a button component](/blog/images/2024-12-03/another-file.avif)

Say you have a button component. You create a form and import that button to use. This is a relationship we take for granted because we do it all the time, but there are some distinct benefits to this.

First, we see the impact of our change immediately. We make a change in the button, and we either see the result rendered in the browser, or we get a failed compilation. Or we have a test suite running that will fail or pass a test. Or lint rule warnings appear in our IDE. We immediately see the result of the change we've made, and the impact on the relationship.

This makes iteration fast: we see the impact of the change and can either refine that change or move on to the next one.

## One step away in distance: importing from a package

Let's take a step further away and think about the relationship when you have imported something from a package.

![Diagram showing a form component depending on a design system package that bundles a button component](/blog/images/2024-12-03/package.avif)

Say you have a design system published for your organization. You import the button from that package to use in your form. This looks very similar to what we did before, but we've introduced a big change in this relationship: seeing change is no longer immediate.

If we make a change in the button, there will be some sort of compilation, bundling, and publishing that will need to happen. And we'll need to consume the latest version of the package to actually see the change.

This is a slow process when you're working alone, but it can be managed with some tools. However, what happens if this change crosses team boundaries? Your design system team makes a change to the button and has to go through a PR review and merge process. Eventually that change is released as a new version and published. At some point later, you upgrade your version of the dependency just to find out the button has changed. But there's a bug! You report back to the design system team, and now they're going through this entire process again to get the fix in and published. This iteration cycle is very slow because understanding the impact of the change in the design system is no longer immediately apparent to consumers.

## Even further away: APIs

Let's step one step further: using APIs. Your frontend (in most cases) requires a backend, and it will be broken without it.

![Diagram showing a frontend sending requests to a backend, and the backends responds to the frontend](/blog/images/2024-12-03/api.avif)

There is an **implicit dependency** between the frontend and backend. You don't import code directly, but you do depend on the backend to function.

Let's say that there's a new API endpoint needed, and you agreed with the team that it would be called `api/v1/contact/create` and would accept a payload with `contactName`.

But, the backend team had a conversation about naming standards during their sprint and made the decision that it could really be `contact/init` with a payload of `fullName`.

Understanding the impact of this change is now far-removed from making the change. Not only is there the PR merge, packaging, and releasing, but also deployment. It may not be until the end of the sprint before the impact of this change is actually understood. This iteration is practically glacial.

## How do monorepos help?

How do monorepos help with these relationships? **They shorten the distance of relationships between code.** Code is **colocated** so that the impact of your change can be understood immediately.

In the example with the design system, the button will be imported directly instead of going through a build and package process. The design system team can immediately see the impact of the change they're making and either adjust their approach or fix the issue directly in the consuming app.

For the API team, we can define that implicit relationship between backend and frontend so that we trigger e2e tests to confirm a change works. Or we can generate models from the backend to be consumed by the frontend. When the models are changed, the frontend code that imported those models will immediately reveal the impact of the change.

You might think that moving projects into a single repository changes the relationship between the projects. But the relationships we've talked about here already exist; the monorepo makes those relationships explicit and well-defined. With good monorepo tooling, we can understand the impact of change along any of these relationships faster in a monorepo.

## Learn more

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Bluesky](https://bsky.app/profile/nx.dev)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
