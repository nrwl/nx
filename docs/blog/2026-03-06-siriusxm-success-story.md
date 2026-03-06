---
title: 'How SiriusXM Stays Competitive by Iterating and Getting to Market Fast'
slug: siriusxm-success-story
authors: ['Philip Fulcher']
tags: ['customer story']
description: "How SiriusXM's commerce team uses a composable 1,400-project Nx monorepo to rapidly assemble and ship new checkout experiences, saving 61+ days of compute monthly with an 82% cache hit rate."
cover_image: /blog/images/2026-03-06/header.avif
youtubeUrl: https://youtu.be/Q0ky-8oJcro
metrics:
  - value: '61+ days'
    label: 'compute saved monthly'
  - value: '1,400+'
    label: 'projects in monorepo'
  - value: '82%'
    label: 'cache hit rate'
  - value: '1+ hour'
    label: 'saved per PR'
pinned: true
---

SiriusXM is a leading audio entertainment company that delivers music, sports, talk, and podcasts to millions of subscribers. Behind the scenes, their commerce engineering team builds and maintains the digital experiences that power customer acquisition — from signing up for subscriptions to managing accounts. In a competitive streaming landscape, their ability to rapidly iterate on these checkout and conversion flows directly impacts the business.

For the past five years, that velocity has been powered by a monorepo managed with Nx. Today, that workspace has grown to over 1,400 projects — a composable architecture that enables the commerce team to assemble new customer experiences from modular libraries and get them to market fast.

## The Need for Speed in Commerce

SiriusXM's commerce team is always looking for new ways to capture sales and move customers through the subscription funnel more effectively. That means constantly shipping new variations of checkout experiences — taking the same core UI components and customer journeys, tweaking them, and testing what works.

This cycle demands an architecture that makes it easy to identify what's already been built, compose it into a new experience, fill in the gaps, ship, learn, and repeat. The team needed their monorepo to actively accelerate this iteration loop.

## Building a Composable Architecture with Nx

Justin Schwartzenberger, Principal Software Engineer at SiriusXM, has spent the last five years investing in the team's monorepo to make that iteration speed possible. The goal: a workspace where composing new commerce experiences from existing building blocks is fast and reliable.

{% testimonial
name="Justin Schwartzenberger"
title="Principal Software Engineer, SiriusXM"
image="/documentation/blog/images/2026-03-06/justin-headshot.avif" %}
We need to be able to take a new project that comes in, identify the requirements quickly, identify the things off the shelf that we have, composite that together to that new experience, fill in the gaps where we need to, and then get that out to market and learn, and then rinse and repeat.
{% /testimonial %}

The team structured their workspace around reusable libraries and well-defined project boundaries. Features, UI components, and customer journeys each live in their own composable projects that can be mixed and matched across different checkout and account management experiences. New projects don't start from scratch — they are assembled from proven, tested components, with most of the effort applied toward the new pieces layered on top.

Nx is the engine that makes this composable approach work at scale.

{% testimonial
name="Justin Schwartzenberger"
title="Principal Software Engineer, SiriusXM"
image="/documentation/blog/images/2026-03-06/justin-headshot.avif" %}
For me, Nx is a tooling system that really enhances your business processes for managing code, managing features, managing apps.
{% /testimonial %}

## Accelerating CI with Nx Cloud

The decision to adopt Nx Cloud came when the team migrated to GitHub Enterprise and GitHub Actions. Remote caching and intelligent task distribution were natural next steps to maximize CI performance across a rapidly growing workspace.

{% testimonial
name="Justin Schwartzenberger"
title="Principal Software Engineer, SiriusXM"
image="/documentation/blog/images/2026-03-06/justin-headshot.avif" %}
The decision for us to jump to Nx Cloud was really something we always probably wanted from the beginning. There's just nothing but benefits from it.
{% /testimonial %}

### Enterprise Partnership

As an Enterprise tier customer, SiriusXM gets direct access to the Nx team for questions and strategic guidance. Even with five years of deep Nx expertise, having a direct channel to the team behind the tool has been invaluable for navigating edge cases and staying ahead of new capabilities.

{% testimonial
name="Justin Schwartzenberger"
title="Principal Software Engineer, SiriusXM"
image="/documentation/blog/images/2026-03-06/justin-headshot.avif" %}
Being an Nx Enterprise customer has been super helpful for us. There's a lot of stuff we can handle on our own, but there's a lot of times where we'll have a specific question — I know I can get a quick answer, or even better, throw that out there and they'll bring somebody into the conversation to help get you some answers and direction.
{% /testimonial %}

## Results

### A Composable Monorepo that Scales

Over five years of investment, SiriusXM's commerce workspace has grown to over 1,400 projects across multiple workspaces. This is a deliberate architectural choice: more fine-grained projects means better caching, more precise affected commands, and faster CI runs. Each project is a building block that can be reused across new commerce experiences.

The numbers tell the story:

- **61+ days of computation saved every 30 days** across their workspaces — over two months of compute time reclaimed monthly
- **82% cache hit rate** consistent across workspaces, meaning the vast majority of tasks never need to run twice
- **Over 1 hour saved per PR** in their largest workspace, giving developers faster feedback loops on every change

### Faster Time to Market

The real business impact is in how fast the team can ship. With architecture powered by Nx, new checkout flows and conversion experiments go from requirements to production quickly. The team can confidently reuse tested components, knowing that Nx's dependency graph ensures only what's affected gets rebuilt and retested. The iteration loop that drives SiriusXM's commerce strategy — build, ship, learn, repeat — runs faster than ever.

{% testimonial
name="Justin Schwartzenberger"
title="Principal Software Engineer, SiriusXM"
image="/documentation/blog/images/2026-03-06/justin-headshot.avif" %}
For me, Nx just really means tooling and efficiency around our software development lifecycle that empowers us to move a lot faster and ship code faster and more reliably.
{% /testimonial %}

{% call-to-action title="Ready to ship faster?" url="/enterprise" icon="nxcloud" description="Learn how Nx Enterprise can help your team accelerate delivery and scale with your organization." size="lg" /%}
