---
title: Improve your architecture and CI pipeline times with Nx projects
slug: improve-architecture-and-ci-times-with-projects
authors: [Philip Fulcher]
tags: ['customer story']
cover_image: '/blog/images/2024-10-25/header.avif'
description: "US sports retailer's Nx monorepo transformation: CI pipeline times from 1hr to 7-9min, cache hit rates from 20% to 57%."
---

When adopting monorepos and Nx, it can feel like there's a lot that needs to be understood first before you get all the benefits. Oftentimes it's tempting to skip some fundamentals and just add all your code into one monorepo and call it a day. Following this mentality is the best way to actually _increase_ your CI run times and cost. Monorepos should simplify your architecture and reduce costs, not cause you to spend more money and time to build, test, and deploy. To make this possible, following a simple restructure of multiple applications and investing time and effort into setting up your monorepo can pay off in the long run. But what does this ideal structure look like, and what are the benefits?

## Real World Example

![Graphs showing pipeline improvements](/blog/images/2024-10-25/improvement-graph.avif)

While it's easy to say this architectural approach is better, it does help to highlight cases where other teams have faced this very challenge. A major sports retailer in the US made the switch to monorepos powered by Nx and faced several challenges. Their project structure had a massive amount of code duplication across all of the apps in monorepo. When measuring their initial migration, they had an average **CI run time of an hour** and a **cache hit rate of under 20%**. We worked with this team and were able to guide them along their migration to figure out where they could make the biggest impact. After investing in this effort, they've been able to cut their CI run times down to **7-9 minutes** and with a **cache hit rate of 57%**. This significant improvement can all be traced back to following best practices.

## Projects All The Way Down

In our sports retailer monorepo, let's consider that we have three apps for different parts of our frontend. In a worst case scenario, we bring all these apps together, configure their CI pipelines, and call it a day. This bare minimum, while it does give us a monorepo, it does not provide any real substantial value outside of dependencies being matched across the apps. As we start to add more and more to the monorepo, we'll see our CI run times start to increase. Anytime we try to cut a release, we'll be left waiting longer and longer. So what's the solution here?

Let's say we have some code in our app that exists in all three of our apps that is copied across all of them. When your PR hits CI, this portion of code is built, tested, and linted in every place that it is copied, which is unnecessary. One block of shared code won't fix our CI pipeline times, but it will set us on the correct path. The solution is to start migrating portions that are common across any apps in a monorepo into its own project that we can import.

Splitting this code out with Nx is as simple as generating a new project and migrating that code over. So this:

```text
monorepo/
└── apps/
    ├── storefront/
    ├── internal-dash/
    └── support-dash/
```

Becomes this:

```text
monorepo/
├── apps/
│   ├── storefront/
│   ├── internal-dash/
│   └── support-dash/
└── libs/
    └── date-time-utils/
```

![Graph of applications depending on a shared library](/blog/images/2024-10-25/apps-with-shared-lib.avif)

This small change will now allow Nx to cache the task results of our `date-time-utils`. That way, when we attempt to build, test, or lint our apps, Nx will simply provide the cached results if the project hasn't been changed. As we migrate more and more of our code into their own projects, the caching features become more and more impactful.

Splitting our shared utilities seems like a very reasonable first step, but we can take this further by actually splitting any UI features into their own projects. This is helpful if we've standardized around a particular frontend framework, then sharing those components across any number of apps becomes trivial. A secondary aspect of this is now we can ensure consistency across our UI design all while reducing our build times further down.

## Projects aren't just for shared code

Shared libraries often make sense as a first attempt at optimizing monorepo architecture because it mirrors what we see in a multirepo approach. Grouping code that's used in multiple places into a single reusable library scratches that engineering itch to be DRY. But shared code is not the only code that should be in projects in a monorepo. Applications themselves can also be broken down into projects.

Why? Caching and parallelization of tasks happens at the **project** level. Dividing code into logical pieces and separating it into separate projects allow us to:

- **Run tasks faster** - Running tasks on smaller projects = faster run times
- **Cache more results** - Making changes to smaller projects results in fewer affected projects = running fewer tasks in CI

Imagine this application has three routes:

```text
storefront/
├── product-search
├── product-details
└── checkout
```

If we leave this application as-is, we build, test, and lint this entire application any time we make a change.

If we instead break these routes into their own projects:

```text
monorepo/
├── libs/
│   shared
│   │   └──date-time-utils/
│   └──storefront/
│       ├──product-search/
│       ├──product-details/
│       └──checkout
└── apps/
    ├── storefront/
    ├── internal-dash/
    └── support-dash/
```

![Graph of application depending on projects](/blog/images/2024-10-25/app-with-route-projects.avif)

The routes exist as projects which are then imported by the application. We can now lint and test the app and those routes individually. If we make a change to one route, we don't have to lint and test the other routes.

## Improve Your Builds, Talk With Us

Adopting a monorepo powered by Nx on its own does not solve build speeds or CI pipeline times. But adopting a monorepo and taking the time to reevaluate your architecture can lead to a significant improvement in build times when best practices are applied. If you're curious to know more, reach out to us to see how Nx can improve your monorepo experience and ship faster!

{% call-to-action title="Explore Nx Cloud for Enterprises" url="/contact/sales" icon="nxcloud" description="Learn more about our offerings for enterprises and contact our team" %} Explore Nx Cloud for Enterprises {% /call-to-action %}

## Further reading

- [Project size in monorepos](/concepts/decisions/project-size)
- [Folder structure for project](/concepts/decisions/folder-structure)
- [Defining dependency rules between projects](/concepts/decisions/project-dependency-rules)
