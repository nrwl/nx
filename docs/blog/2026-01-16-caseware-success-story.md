---
title: "Scaling 700+ Projects: How Nx Became a 'No-Brainer' for Caseware"
slug: caseware-success-story
authors: ['Philip Fulcher', 'Juri Strumpflohner']
tags: ['customer story']
description: 'Discover how Caseware unified 700+ projects into one monorepo, achieved a 93% cache hit rate, and saves 181 days of compute weekly with the Nx platform.'
cover_image: /blog/images/2026-01-16/header.avif
youtubeUrl: https://www.youtube.com/watch?v=lvS8HjjFwEM
metrics:
  - value: '700+'
    label: 'projects in unified monorepo'
  - value: '93%'
    label: 'cache hit rate'
  - value: '181 days'
    label: 'of compute saved weekly'
  - value: '10+ years'
    label: 'of legacy code migrated'
---

Caseware is a global leader in audit and analytics software, trusted by financial professionals in over 130 countries. Their platform engineering team maintains and modernizes the development infrastructure behind dozens of products, each with different technical stacks and histories.

Today, Caseware operates across four core platform teams, each one containing multiple squads building interconnected applications. The organization manages a unified monorepo containing roughly 700 projects alongside additional monorepos maintained by individual solution teams. This architecture enables them to maintain development velocity while ensuring code quality and system integration across their engineering organization.

It hasn't always been like this, though. Managing software development at this scale creates problems that become harder to ignore as organizations scale.

## Challenge

Caseware's architecture historically consisted of Java and C# backends paired with a diverse collection of frontend technologies. These grew organically as teams exercised significant autonomy in their technology choices.

This autonomy fostered innovation, but it also created operational challenges. Teams operated in silos, each with their own workflows, toolchains, and expectations. With more than 700 projects spanning 10+ years of legacy code, this fragmentation increased development overhead and resulted in inconsistent user experiences across their product suite.

As Amir Toole, VP of Engineering at Caseware, describes it:

{% testimonial
    name="Amir Toole"
    title="VP of Engineering, Caseware"
    image="/documentation/blog/images/2026-01-16/amir-toole-caseware-headshot.avif" %}
There was no conformity, really, so every team had a lot of autonomy. Our end-user product was quite different as you went between one team's product to the next.
{% /testimonial %}

## Solution

Rather than mandating a wholesale migration, Caseware's platform engineering team took a strategic, incremental approach to consolidation that let results speak for themselves.

### Starting with Frontend Consolidation

The team began by creating a frontend monorepo with shared Angular libraries. This enabled development teams to share code, UX components, and styling standards, bringing a more uniform experience for customers. The shared library approach quickly became the standard for building apps across the organization, and teams that initially had full autonomy over their technology choices voluntarily migrated their frontend code to the shared workspace.

### Organic Expansion to Full-Stack

As teams experienced efficiency gains from the shared frontend architecture, they started asking a natural question: **what if backend applications could benefit from the same approach?** The platform team moved a small backend app into the monorepo, loved the results, and expanded from there. Now every app lives in the unified workspace, creating efficiencies not just in local development but in CI/CD as well.

### Immediate Value from the Enterprise Tier

When the Nx team offered a trial of the Enterprise tier, the implementation was straightforward: a simple, one-line change to their `nx.json` configuration. The feedback was immediate: developers recognized it as a huge timesaver.

When the trial period ended, the reaction made the business case unmistakably clear:

{% testimonial
    name="Amir Toole"
    title="VP of Engineering, Caseware"
    image="/documentation/blog/images/2026-01-16/amir-toole-caseware-headshot.avif" %}
After that trial, once it expired, it was like immediate — 'oh no, what are we going to do?'
{% /testimonial %}

### Building Trust Through Migration Support

Caseware recognized that the barrier to adoption wasn't reluctance; it was the effort required to migrate. They invested in proper migration support by dedicating a team specifically to assist other teams through the transition process. By taking the time to walk teams through the process and assist with anything that came up, they built mutual trust and confidence that the monorepo was the right path.

### Proactive Partnership with the Nx Team

The ongoing partnership with the Nx team provides value beyond the tooling itself. Regular check-ins offer strategic guidance, but some of the biggest wins come unexpectedly: the Nx team sometimes builds bespoke metric reports that include bleeding-edge data or aggregates collected over prior months that help zero in on pain points within the repo.

## Results

### Unified Development at Enterprise Scale

Caseware successfully transformed their fragmented development landscape into a unified ecosystem supporting 700+ projects. By using Nx's remote caching, they achieved a 93% cache hit rate, reclaiming thousands of compute hours each week. The numbers are striking: caching both locally and in CI saves the team 181 days of compute every single week, freeing up over 5,400 hours for faster iteration and delivery.

### Metrics That Justify the Investment

With applications containing over 10 years of legacy code, having detailed metrics at the project and task level became crucial for understanding and improving their development process — and for justifying continued investment to leadership.

{% testimonial
    name="Amir Toole"
    title="VP of Engineering, Caseware"
    image="/documentation/blog/images/2026-01-16/amir-toole-caseware-headshot.avif" %}
Being able to log into the Nx site and see all the tasks being run, seeing how much time we were saving — those were all great metrics to provide to the management team to help justify the value add that Nx provides.
{% /testimonial %}

Because Nx understands the codebase at the task level, the platform engineering team can pinpoint exactly where time is being saved and where bottlenecks remain. This visibility makes budget conversations straightforward.

### Organic Adoption Through Demonstrated Value

By focusing on demonstrating value rather than mandating adoption, Caseware achieved voluntary team migration to the monorepo. The combination of dedicated migration support, proven efficiency gains, and ongoing collaboration with the Nx team created the trust necessary for sustainable, enterprise-wide adoption.

What began as a platform initiative to streamline frontend development has evolved into a long-term advantage — reducing costs, accelerating delivery, and empowering teams to ship faster without sacrificing quality.

{% call-to-action title="Ready to scale your enterprise development?" url="/enterprise" icon="nxcloud" description="Learn how the Nx platform can help your organization achieve similar results with enterprise-grade support and insights." size="lg" /%}
