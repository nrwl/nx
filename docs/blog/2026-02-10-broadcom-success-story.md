---
title: 'How Broadcom stays efficient and nimble with monorepos'
slug: broadcom-success-story
authors: ['Philip Fulcher']
tags: ['customer story']
description: 'How Broadcom unified 177+ projects in a monorepo with Nx, achieving 70% cache hit rates and saving 361 days of compute monthly while scaling development across their entire organization.'
cover_image: /blog/images/2026-02-10/header.avif
youtubeUrl: https://www.youtube.com/watch?v=RWTgYNKqxNc
metrics:
  - value: '361 days'
    label: 'compute saved monthly'
  - value: '70%'
    label: 'cache hit rate'
  - value: '177+'
    label: 'projects unified'
  - value: '2x faster'
    label: 'CI pipelines'
---

Broadcom is a global technology leader providing semiconductor, enterprise software, and security solutions to thousands of customers worldwide. Their engineering organization manages a wide portfolio of complex applications, including the [VMware](https://www.vmware.com/) suite of products. Their frontend architecture team has spent nearly a decade figuring out how to manage this portfolio efficiently.

Managing software development at the enterprise scale can be an uphill battle requiring coordination and cohesion across multiple teams and products that each face their own unique challenges. They may serve very different user groups, or have to work with the constraints of legacy systems or a recent acquisition. Developers across the organization were losing time to infrastructure work: configuring builds, debugging CI pipelines, waiting for tests to run. Every hour spent on DevOps was an hour not spent building features. In order to consolidate and standardize these processes to boost efficiency, a monorepo was chosen as a logical place to start by combining multiple projects into a single repo. They faced not only technical challenges with this approach, but some internal resistance from teams used to working autonomously.

They reached a point where they wanted some outside help on effectively working with a monorepo, so they reached out to our co-founders Victor Savkin and Jeff Cross.

## A Partnership From Day One

Long before Nx became a widely-adopted platform, Broadcom's team was already working with its creators.

{% testimonial
name="Laurent Delamare"
title="Front End Architect, Broadcom"
image="/documentation/blog/images/2026-02-10/laurent-headshot.avif" %}
The first time we came across Nx was at the very beginning of the company. We contacted Victor and Jeff to help us refactor very large JavaScript applications, and soon after they started to release the first version of the tool. We saw that as a natural fit to improve our team's development experience.
{% /testimonial %}

That early bet paid off. As Nx evolved into a full platform, Broadcom evolved with it, learning what works at scale and building institutional knowledge that would prove essential years later.

## From Organizational Chaos to Seamless Collaboration

Teams had spent years developing their own workflows. They had preferred coding styles, familiar toolchains, and the autonomy to work however they wanted. Asking them to give that up for a shared monorepo was a huge cultural shift.

{% testimonial
name="Laurent Delamare"
title="Front End Architect, Broadcom"
image="/documentation/blog/images/2026-02-10/laurent-headshot.avif" %}
We had to go against some of the internal culture of people being more comfortable with their own style of programming. So we had to show them the benefits by showing results before they were convinced that it was the best way to go.
{% /testimonial %}

## Show, Don’t Tell: Making the Case for a Monorepo

The platform team made a strategic choice: don't mandate monorepo adoption. Prove it.

{% testimonial
name="Laurent Delamare"
title="Front End Architect, Broadcom"
image="/documentation/blog/images/2026-02-10/laurent-headshot.avif" %}
To make people more comfortable with the monorepo approach, I think you have to lead by example. You show them how you make their life easier and they can focus on real work—forget about DevOps, the hard way of building or running tests. They'll be happy and they follow you along.
{% /testimonial %}

The approach worked. Teams that joined the monorepo found their builds faster and their workflows simpler. Word spread. Resistance faded.

These gradual improvements added up, but there were still huge savings to be found. When remote caching and intelligent task distribution were adopted as part of the Enterprise tier, CI times dropped dramatically. Builds now finished in half the time.

## Where they are now

Today, Broadcom's monorepo contains 177 projects, and it continues to grow. Additional applications are slated to merge into their monorepo this year, and the foundation is ready to support them.

The numbers back that up:

- **361 days of computation saved every 30 days** - nearly a year of compute saved monthly
- **70% cache hit rate**, stable and consistent across the workspace
- **29-minute average CI times** across 177 projects
- **2x speed improvement** after remote caching and task distribution

But the metrics only tell part of the story. The real shift is organizational. What started as one team's experiment is now company-wide strategy.

The long-standing partnership with Nx continues to pay dividends. Regular collaboration keeps Broadcom at the cutting edge of what's possible, like keeping CI pipeline times consistent no matter how much work is thrown at them.

{% testimonial
name="Laurent Delamare"
title="Front End Architect, Broadcom"
image="/documentation/blog/images/2026-02-10/laurent-headshot.avif" %}
To me, Nx means the best developer experience I've had in my career. It's a tool that helps us be so much more productive and be better at our job.
{% /testimonial %}
