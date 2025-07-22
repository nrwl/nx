---
title: 'Hetzner Cloud gets More Features to Market with Faster, More Reliable CI'
slug: hetzner-cloud-success-story
authors: [Juri Strumpflohner]
tags: ['customer story']
description: Discover how Hetzner Cloud uses Nx Enterprise to ship new features to market faster and with more reliability.
youtubeUrl: https://www.youtube.com/watch?v=2BLqiNnBPuU
cover_image: /blog/images/articles/hetzner-cloud-story-bg.jpg
metrics:
  - value: '116+'
    label: 'projects in modular architecture'
  - value: '85%'
    label: 'cache hit rate'
  - value: '6 days'
    label: 'of computation saved every single day'
  - value: '45→6'
    label: 'minutes on CI'
---

Hetzner Cloud is a leading provider of cloud infrastructure solutions, known for its reliability and flexibility. Their platform enables businesses to deploy and manage cloud environments efficiently, catering to a broad range of use cases, from hosting applications to scaling complex workloads. As the company grew, its engineering team faced challenges in maintaining development speed and team collaboration.

## Challenge

As Hetzner Cloud scaled its operations, two primary challenges emerged:

- **Team structure and scaling** – The growing codebase made it difficult to organize teams efficiently and allocate clear ownership.
- **CI performance** – Long feedback loops slowed down development, making it harder to ship updates quickly.

> Changes often required modifying several repositories and running multiple pipelines, adding unnecessary complexity and slowing development.

They found themselves in the situation that plagues most large organizations: the struggle with code organization. Over time, a monolithic architecture can become difficult to manage, with tightly interwoven dependencies making it hard to separate concerns. Hetzner Cloud's engineering team needed a structured approach to:

- Modularize their monolithic application into smaller, more manageable units.
- Allocate teams more effectively by defining ownership at a modular level.
- Enforce clear boundaries between different parts of the system to prevent unintentional dependencies.

In addition to their monolith, Hetzner Cloud had multiple related projects spread across GitLab. Changes often required modifying several repositories and running multiple pipelines, adding unnecessary complexity and slowing development.

Their existing CI setup presented another major challenge.

- Pipelines took **45 minutes per run**, introducing significant delays in shipping features.
- GitLab merge trains helped maintain code quality but resulted in redundant work, repeatedly running tests and builds even when unchanged code was involved.

Hetzner Cloud needed a solution that would streamline their development process, consolidate fragmented projects, and significantly improve CI performance.

## Solution

After evaluating Nx and Turborepo, Hetzner Cloud selected Nx for its advanced monorepo management capabilities. They started a [Nx Enterprise](/enterprise) contract and closely collaborated with the Nx Developer Productivity Engineers to assess Hetzner's current software landscape and evaluate the best strategy. Their goal was not necessarily to create a monorepo in the first place, but to modularize their monolithic application. Nx provided the right tools to:

- **Break down the monolith** into modular packages without affecting deployment.
- **Define clear domain boundaries** using [module boundary rules](/features/enforce-module-boundaries) and [conformance rules](/reference/core-api/conformance).
- **Improve ownership management** by having a more modular structure with clear boundaries allowing for easier allocaton of owernship. Something that could further be improved in the future by using [CodeOwners](/nx-enterprise/powerpack/owners).

Beyond modularization, Nx helped consolidate fragmented projects into a single, structured workspace. This reduced the overhead of maintaining multiple repositories and simplified dependency management. Using the [Nx Graph](/features/explore-graph), the team gained visibility into their project relationships, making it easier to coordinate work and optimize collaboration.

{% testimonial
    name="Pavlo Grosse"
    title="Senior Software Engineer, Hetzner Cloud"
    image="/documentation/blog/images/articles/pavlo-grosse.avif" %}
Junior developers were amazed at how fast things became. They'd run tests expecting them to take 20 minutes, and they'd finish in seconds!
{% /testimonial %}

To tackle the CI performance bottleneck, Hetzner Cloud adopted [Nx Cloud](/ci/features/remote-cache), highly leveraging its [Nx Replay feature](/ci/features/remote-cache), ability to [distribute runs](/ci/features/distribute-task-execution) and re-run [flaky tasks automatically](/ci/features/flaky-tasks). These capabilities allowed them to optimize their CI workflows and eliminate inefficiencies that had previously slowed down development cycles.

- **Minimized redundant processing** – PRs in merge trains only reprocessed necessary parts, restoring everything else from the [Nx remote cache](/ci/features/remote-cache).
- **Drastic CI time reduction** – Pipelines that previously took **45 minutes** now averaged **6 minutes**, even as more projects were onboarded.
- **Improved debugging capabilities** – Nx Cloud provides insights into task execution times and makes it easy to search logs of failed ones, making troubleshooting more efficient.

Also having the **[Nx Console extension in their IDE](/getting-started/editor-setup)** was a big time saver when working with a large workspace with hundreds of projects. It allows you to explore the workspace in a more visual way and trigger tasks directly from within the IDE vs typing commands in the terminal.

## Results

### From a Monolith to a Modular Architecture with 116+ Projects

By structuring their codebase into fine-grained packages, Hetzner Cloud successfully transitioned from a large monolith to a modular architecture. This shift **made the codebase easier to maintain and evolve**, reducing dependencies between different parts of the system. It also allowed teams to be allocated more effectively, ensuring **clear ownership of specific areas** within the codebase, leading to a more efficient and scalable development process.

### Pipeline Speed Improved Despite Codebase Growing to Hundreds of Projects

CI performance saw a dramatic improvement. **Build times dropped from 45 minutes to most runs being around 6 minutes**, with some reaching up to 20 minutes. As Hetzner Cloud modularized the monolith into separate projects and brought in additional ones, **the codebase grew, yet CI execution time kept decreasing**, making scaling seamless. An 85% cache hit rate saved a staggering 6 days of compute time per day, totaling 197 days saved monthly.

### Shipping Features Faster

Consolidating projects into a single repository **eliminated the complexity of managing multiple repositories and pipelines**, reducing overhead from maintaining separate CI setups. This simplified cross-project changes, **allowing the team to ship features faster** and with greater confidence.

### Continuous Refinement in Collaboration with Nx DPE Team

Hetzner Cloud continues to **work closely with the Nx Developer Productivity Engineering (DPE) team** to monitor and refine their setup. By actively collaborating, they ensure that their monorepo remains optimized and that their CI is continuously improved. This ongoing partnership allows Hetzner Cloud to adapt to new challenges, fine-tune configurations, and further push the boundaries of efficiency in their development workflow.

{% call-to-action title="Want to achieve similar results?" url="/contact/sales" icon="nxcloud" description="Learn more about Nx Enterprise or get started with a free trial." /%}
