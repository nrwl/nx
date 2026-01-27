---
title: 'Autonomous Agents at Scale'
slug: ai-agents-and-continuity
authors: ['Victor Savkin', 'Juri Strumpflohner']
tags: ['nx', 'monorepo', 'ai']
description: 'As AI agents become more autonomous, writing code is no longer the constraint. The organizations that win will be the ones where more work can be delegated to agents running uninterrupted.'
cover_image: /blog/images/articles/bg-autonomous-agents-at-scale.avif
hideCoverImage: true
---

The bottleneck has shifted. As AI agents become more autonomous, **writing code is no longer the constraint**. Most organizations aren't ready for this. Their architectures still put humans in the middle to do the coordination, limiting what agents can accomplish.

## The Fragmentation Problem

For example:

1. A change touching multiple repos means fresh agent sessions with context re-explained each time, multiple PRs to monitor, and handoffs between people. Agents do the coding. Humans still do research, planning, and orchestration. What could be one session becomes dozens of handoffs over weeks.
2. Even when a change is local to one repo, humans often have to research code in other repos to understand context and best practices.
3. Every push to CI is a potential interruption. CI can break due to flaky tasks or issues with the change itself. Humans have to attend, pass information back and forth, and help the agent course-correct.

**The goal is autonomy:** one continuous agent session that implements an entire feature. No handoffs. No re-explaining. No context lost. It updates all projects that need updating and iterates on CI until the build is green.

**Two things prevent this:**

- **Horizontal fragmentation.** Code lives in multiple repos. An agent in Repo A can't see Repo B. A human must bridge the gap. Every repo boundary is a forced interruption. Every repo boundary limits the agent's autonomy.

- **Vertical fragmentation.** Local and CI are separate environments. When a PR fails, someone stops, reloads context, diagnoses, fixes, pushes, waits. Every interaction breaks autonomy.

## Nx = Autonomous Agents at Scale

Nx enables autonomous AI agents at scale.

![Nx solves fragmentation](/blog/images/articles/fragmented-vs-continuous-sessions.avif)

**Nx solves the horizontal fragmentation problem** by giving agents access to all relevant projects at once. In a monorepo, one session reads all projects, deduces best practices from existing code, and creates a single PR touching dozens of projects.

Here's a video showing the same work done in two setups. The version in Nx, requiring a single Claude Code session, was 4x faster.

{% youtube
src="https://youtu.be/alIto5fqrfk?si=QBnRX1uFbpmr-xeW"
title="Nx Monorepo vs Polyrepo: AI Agent Comparison"
width="100%" /%}

This video explains this issue using interactive visualization:

{% youtube
src="https://youtu.be/UATA8CsaOhU"
title="AI Agents and Monorepo Visualization"
width="100%" /%}

**Nx solves the vertical fragmentation problem** through its Self-Healing CI agents. Failures are diagnosed, fixed, and validated automatically while the PR is still running. When Self-Healing CI cannot confidently fix an issue, all relevant information is passed back to the coding agent (running locally or in the cloud) so it can iterate and push again.

{% youtube
src="https://youtu.be/LaZroK4b-zQ"
title="Nx Monorepo vs Polyrepo: AI Agent Comparison"
width="100%" /%}

## Solving the Constraint

**Any improvement not at the constraint is an illusion.** Agents are making code authoring so cheap that CI and human coordination become the bottleneck.

Already today, AI agents can run autonomously for hours and produce massive code changes. With some high-level guidance, a developer can change an API and all of its clients, make CI green, and ship it in a single session.

**The organizations that win will be the ones where more work can be delegated to agents running uninterrupted. That's what Nx is for.**

In such an organization, every developer is like a surgeon—providing the necessary context and guidance when it's critical, getting a PR to a decent state, and letting the agent finish the rest autonomously to a mergeable state.

---

## Learn more

- [Nx Docs](/docs/getting-started/intro)
- [X / Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Community Discord](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
