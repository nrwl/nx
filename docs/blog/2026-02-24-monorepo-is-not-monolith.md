---
title: 'A Monorepo Is NOT a Monolith'
slug: 'monorepo-is-not-monolith'
authors: ['Victor Savkin', 'Juri Strumpflohner']
tags: [nx, monorepo]
cover_image: /blog/images/articles/monorepo-is-not-monolith-bg.avif
hideCoverImage: true
description: 'Common objections to monorepos debunked: they are not monoliths, they scale, and they work great with AI.'
---

I've been building dev tools for monorepos and helping companies use them for years. **And I've been hearing similar objections to the monorepo idea from many teams:**

- It forces us to release together. Monoliths are bad.
- It lets other teams change my code without my knowing.
- It creates a big ball of mud. It makes applications hard to understand and maintain.
- It doesn't scale.
- AI tools can't handle large monorepos.

Many of them arise from confusion, often after trying a basic workspace setup, seeing a bunch of problems, and concluding that it is not a viable approach for multi-project-multi-team scenarios.

In this article, **I will show what a proper monorepo setup looks like and talk about common misconceptions related to monorepos.**

Monorepos are not a silver bullet. Nothing is. But hopefully **at the end of this article, you will have a clear understanding of the benefits a monorepo brings, what _actual_ challenges you will face, and if it is the right approach for your organization.**

_For the examples in this post, I will use [Nx](/docs/getting-started/intro), an extensible build system optimized for monorepos. But the concepts apply broadly to any monorepo tooling._

{% toc /%}

## What is a Monorepo?

**Monorepo-style development is a software development approach where**:

- You develop multiple projects in the same repository.
- The projects can depend on each other, so they can share code.
- When you make a change, you do not rebuild or retest every project in the monorepo. Instead, you only rebuild and retest the projects that can be affected by your change.

That last point is crucial for two reasons:

**It keeps CI fast.** On a large scale, running only what's affected can be orders of magnitude faster than rebuilding everything. Layer on [remote caching](/docs/concepts/how-caching-works) so work that's already been done is never repeated, and [distribute tasks across machines](/docs/features/ci-features/distribute-task-execution) intelligently, and you have a CI pipeline that scales with your codebase rather than against it.

**It gives teams independence.** If two projects A and B do not depend on each other, they cannot affect each other. Team A will be able to develop their project, test it, build it, merge PRs into master without ever having to run any code written by Team B. Team B can have flaky tests, poorly typed code, broken code, broken tests. None of it matters to Team A.

## Misconceptions

### A Monorepo Is NOT a Monolith

> "Will we have to release all on the same day? I don't like monoliths!"

It's a common misconception, which comes from a strong association of a repository with a deployment artifact.

But it is not hard to see that **where you develop your code and what/when you deploy are actually orthogonal concerns**. Google, for instance, has thousands of applications in its monorepo, but obviously, all of them are not released together.

Moreover, it's actually a good CI/CD practice to build and store artifacts when doing CI, and deploy the stored artifacts to different environments during the deployment phase. In other words, **deploying an application should not require access to any repository**, one or many.

**So a monorepo is not a monolith. Quite the contrary, because monorepos simplify code sharing and cross-project refactorings, they significantly lower the cost of creating libs, microservices and microfrontends. So adopting a monorepo often enables more deployment flexibility.**

### It lets other teams change my code without my knowing

> "Another team can break my app, without my knowing, right before the release!"

This misconception originates from folks only using repository settings to control access and permissions. Not many know that **many tools let you configure ownership on the folder basis**.

For instance, GitHub has a feature called [CODEOWNERS](https://help.github.com/en/articles/about-code-owners). You can provision a file that looks like this:

```rb
apps/app-a/* @susan
apps/app-b/* @bob
```

With this configuration, if you have a PR updating App A, Susan will have to approve it. If the PR touches only App B, Bob will have to approve it. And if the PR touches A and B, both Susan and Bob will have to approve it.

Nx takes this further with [`@nx/owners`](/docs/reference/owners/overview), which lets you define ownership based on **projects and tags** rather than raw file paths. Ownership rules are defined in `nx.json` or per-project `package.json` (or `project.json`) and compiled into standard CODEOWNERS files via `nx sync`. This means ownership stays in sync with your project structure automatically, instead of requiring you to manually maintain path patterns.

You actually get more control over code ownership. Look here:

![Two teams with shared libraries and ownership boundaries](/blog/images/articles/monorepo-misconceptions-codeowners.svg)

We have two teams in the org. Team B want to share code between their applications, so they created a library shared-b. This library is private, so they don't want Team A to depend on it. Why? Because if it happens, the teams will get coupled to each other, and Team B will have to account for Team A when changing the shared library.

In a multi-repo setup, nothing prevents Team A from adding shared-b to their `package.json`. It is hard for Team B to know about it because it is done in a repository they do not control. Most monorepo tools (including Nx) allow you to define the visibility of a library in a precise way. So when trying to import shared-b, you see this:

![Visibility constraint error when importing a private library](/blog/images/articles/monorepo-misconceptions-visibility.avif)

### It creates a big ball of mud

> "Even one of our applications is barely manageable. If we put five of them in the same repo, no one will be able to understand anything at all!"

This misconception comes from the fact that in most repositories any file can import any other file. Folks try to impose some structure during code reviews, but things do not stay well-defined for long, and the dependency graph gets muddled.

Everyone knows this. Open a mid-sized project (maybe 50k lines of code), and draw a dependency diagram of its main components and how they depend on each other. Now check it against the repository. You will find a lot of "unexpected" edges in the graph.

With Nx, you can create libraries that have well-defined public APIs. And because creating libraries takes just a few seconds, folks tend to create more libraries. So a typical application will be partitioned into dozens of libraries, which can depend on each other only through their public APIs.

![Application partitioned into well-defined libraries](/blog/images/articles/monorepo-misconceptions-libs.avif)

Nx also automates the generation of the dependency graph which you can view by running `nx graph`.

![Nx dependency graph visualization](/blog/images/articles/monorepo-misconceptions-graph.svg)

In opposite to the diagram created by some architect you can find in your wiki, which became outdated the day after it was created, this graph is correct and up to date.

You can also [enforce module boundaries](/docs/features/enforce-module-boundaries) by adding tags to your projects and defining dependency constraints. For instance, you can tag projects with `scope:client` or `scope:shared` and create rules like "client-scoped projects can only depend on client or shared projects." These constraints are enforced at lint time via the `@nx/enforce-module-boundaries` ESLint rule, meaning violations are caught before code is even committed. You can statically guarantee that presentation components cannot depend on state management code, or that a team's private library cannot be imported by another team.

![Module boundary constraint violation](/blog/images/articles/monorepo-misconceptions-boundaries.avif)

Funny enough, this is another case where using monorepos results in the opposite of what a lot of folks think.

### It does not scale

> "Am I to expect 5 hour CI time?"

Rebuilding and retesting everything on every commit is slow. It does not scale beyond a handful of projects. But as mentioned above, when using monorepo tools, you only rebuild and retest what is affected.

Modern monorepo tooling provides a layered scaling strategy that you can adopt incrementally:

1. **Affected commands**: only run tasks for projects impacted by your change. This alone can cut CI time dramatically.
2. **Local and remote caching**: never redo work that's already been done. [Remote caching](/docs/concepts/how-caching-works) (via Nx Replay) shares results across your team and CI, so if a teammate already built that library, you get the result instantly.
3. **Distributed task execution**: when a single machine isn't enough, [Nx Agents](/docs/features/ci-features/distribute-task-execution) dynamically distribute tasks across multiple machines based on the dependency graph and historical runtime data.
4. **Task atomization**: large test suites become a bottleneck even with distribution. The [Atomizer](/docs/features/ci-features/split-e2e-tasks) splits monolithic e2e or integration test targets into per-file tasks that can run in parallel. A 10-minute e2e suite becomes five 2-minute tasks spread across agents.

Each layer builds on the previous one, and you only adopt what you need at your current scale.

> "Is git going to break?"

This concern is not truly unjustified. If your repo has millions of files, many tools you know and love, including plain Git, will stop working. However, most monorepos do not have thousands of apps. They have a dozen apps built by a single org. Thousands of files, millions of lines of code. All the tools you use can handle this without any problems.

Microsoft released [Scalar](https://github.com/microsoft/scalar), a tool that enables Git to work with enormous repos. Azure Pipelines, BitBucket, and GitHub all support it.

### AI doesn't work in monorepos

> "My codebase is too big, AI tools will be overwhelmed!"

A common concern is that AI coding agents can't handle monorepos because there's too much code, too many projects, too much context. In practice, the opposite is true. Monorepo tooling provides exactly the structure AI agents need: a project graph that maps dependencies, consistent conventions across projects, and clear module boundaries. Instead of an agent guessing how your 15 repos relate to each other, it can query the graph and understand the architecture instantly.

Nx is built to work with AI agents. The CLI is optimized for agent navigation, and dedicated [Nx agent skills](/blog/nx-ai-agent-skills) teach your AI how to explore the workspace, run tasks, scaffold code following your conventions, and even monitor CI pipelines. On the CI side, [self-healing CI](/docs/features/ci-features/self-healing-ci) uses AI to automatically detect and fix pipeline failures, posting fixes as PR comments or auto-applying high-confidence patches. Monorepos don't overwhelm AI: they give it the structure to actually be effective.

If you want to dive deeper into how Nx and AI work together, check out:

- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [End to End Autonomous AI Agent Workflows with Nx](/blog/autonomous-ai-workflows-with-nx)
- [Autonomous Agents at Scale](/blog/ai-agents-and-continuity)

{% callout type="note" title="Dive deeper" %}
We cover additional misconceptions (polyglot support, lockstep versioning, dependency hell, and more) in [10 Monorepo Myths Debunked](/blog/monorepo-myths-debunked).
{% /callout %}

## Real Challenges

The things listed above are misconceptions. It does not mean that monorepos are perfect. They come with their own challenges.

### Trunk-based development

Monorepos and long-lived feature branches do not play together nicely. Chances are you will have to adopt some form of [trunk-based development](https://trunkbaseddevelopment.com/). Transitioning to this style of development can be challenging for some teams, partially because they have to adopt new practices such as feature toggles.

Trunk-based development results in better quality code and higher velocity regardless of repo size, but it is still something you must take into account.

### CI

Moving to a monorepo requires you to rethink how you do continuous integration. You are no longer building a single app: you are building only the things affected by your change, caching aggressively, and potentially distributing work across machines.

The tooling gap that existed in 2019 has largely closed. Nx Cloud provides [remote caching](/docs/concepts/how-caching-works), [distributed task execution](/docs/features/ci-features/distribute-task-execution), [task atomization](/docs/features/ci-features/split-e2e-tasks), and [self-healing CI](/docs/features/ci-features/self-healing-ci) out of the box. The challenge is no longer "can I make this work" but rather tuning your pipeline as your codebase grows.

### Large-scale changes

Monorepos make some large-scale changes a lot simpler: you can refactor ten apps made out of a hundred libs, verify that they all work before committing the change.

But they force you to think through large-scale changes more and make some of them more difficult. For instance, if you change a shared library, you will affect all the applications that depend on it. If it is a breaking change, and it cannot be automated, you will have to make the change in a backward-compatible way. You will have to create two versions of the parameter/method/class/package and help folks move from the old version to the new one.

## Let's Recap

**Monorepos are known for the following benefits:**

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience

**In spite of what folks say, they also:**

- Give you more deployment flexibility
- Allow you to set up precise ownership policies
- Provide more structure to your source code
- Scale well with the right tooling (affected, caching, distribution, atomization)
- Complement AI-assisted development rather than hinder it

**But they come with some challenges:**

- Trunk-based development is a lot more important
- Require more sophisticated CI setup (though modern tooling handles most of it)
- Require you to think about large-scale changes

## Learn More

- [Nx Docs](/docs/getting-started/intro)
- [Nx Community Discord](https://go.nx.dev/community)
- [X / Twitter](https://twitter.com/nxdevtools)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx YouTube Channel](https://www.youtube.com/@nxdevtools)
