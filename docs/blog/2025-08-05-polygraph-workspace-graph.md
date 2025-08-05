---
title: "Nx Cloud Workspace Graph: See Your Organization's Code Structure Like Never Before"
slug: nx-cloud-workspace-graph
authors: ['Philip Fulcher']
tags: ['nx-cloud', 'polygraph', 'enterprise']
cover_image: /blog/images/2025-08-05/header.avif
description: 'Discover how Workspace Graph in Nx Cloud reveals dependencies across your entire organization. See code structure and connections between repositories without cloning, installing, or switching contexts.'
youtubeUrl: https://www.youtube.com/watch?v=raNYaIpHLOg
---

How well do you understand the structure of your code?

Not just your personal code or your team's project, but the code structure of your entire company. Do you understand how other teams structure their code within their repositories? Do you understand how different repos from other teams are all interconnected? And if you wanted to make a change to one project in your company, do you know what the immediate impact of that change would be?

If you don't like your answer to those questions, it's time to take a look at **Workspace Graph**, a powerful new tool within Nx Cloud's [Polygraph](/blog/nx-cloud-introducing-polygraph) suite that reveals the structure and connections across your entire organization.

{% toc /%}

## Understanding the impact of change

A great example of the benefits of monorepos is building a design system. In a monorepo, you have multiple projects inside one repository. If you have your design system in the same repo as the applications that consume it, life is beautiful. You can make a change in the design system, quickly run tests, or even serve up the applications consuming that design system to understand the impact of your changes immediately.

But here's the reality: **as great as monorepos are, it's not always going to work like that.** You're not going to have a single monorepo for your entire organization. It's extremely likely that your design system is going to be consumed by projects outside of that repository.

So how can we get back to that point where we make a change in the design system and understand what its impact will be? We can start by **visualizing the connections** that other repos have with the design system. That's exactly what **Workspace Graph** is designed to do.

## What Is Workspace Graph?

[Workspace Graph](/ci/recipes/enterprise/polygraph#workspace-graph) is part of Nx Cloud's Polygraph suite that visualizes dependencies between all workspaces and repositories in your organization, **even repos that don't use Nx**. Instead of managing repositories in isolation, you can easily see the connections between repos and understand your organizational code structure at a glance.

This visibility helps you:

- **Understand impact before making changes** - When proposing a change in one part of the organization, quickly identify what other parts will be affected
- **Plan architectural decisions with full context** - Make informed decisions about refactoring, migrations, and new feature development
- **Improve team coordination** - Teams can see how their work connects to and impacts other teams' projects

## See Inside Any Repository Without the Overhead

If you've used Nx before, you're probably familiar with the [graph visualization](/features/explore-graph) that allows you to look through the structure of the projects within your repository. But it does require cloning the repo, installing dependencies, and actually running the `graph` command.

![Screenshot of Workspace Graph showing multiple repositories](/blog/images/2025-08-05/workspace-graph.avif)

With Workspace Graph, we can see that same sort of graph **without having to do all that setup**. When repos are using Nx Cloud during CI, graph data is uploaded to Nx Cloud so we can view it like this.

You can expand folders and progressively see more detail about what's actually inside of that workspace. You have **more visibility and more context** about the code structure around your organization without having to bounce back and forth between different repositories.

## Visualizing Cross-Repository Dependencies

Let's explore the connection between repositories. Workspace graph can draw dependencies across multiple repositories by analyzing imports. In this example, we have a design system workspace that publishes an NPM package, and a web app that imports that package.

![Screenshot showing dependency connections between repositories](/blog/images/2025-08-05/multi-repo-graph.avif)

With this Workspace Graph visualization, **we're able to see connections between these repos almost like if we had them all in the same monorepo**. Before we make a change to the design system, we can see what other projects rely on different packages inside of it so we understand the impact before we make the change.

## Beyond Nx: Including Any Repository

The workspace graph is already powerful when showing the graphs and connections of Nx-powered repos. But your company likely has repos that aren't using Nx. This is where **[metadata-only workspaces](/ci/recipes/enterprise/metadata-only-workspace)** come in.

Metadata-only workspaces are workspaces that don't use Nx, but do upload information about themselves to Nx Cloud so we can include them in things like the Workspace Graph and Conformance Rules. [Connecting a metadata-only workspace](/ci/recipes/enterprise/metadata-only-workspace#connecting) is easy and can be done in bulk when using the GitHub integration. [Applying a custom workflow](/ci/recipes/enterprise/metadata-only-workspace#connecting) gathers the graph information on a daily basis so that your workspace graph is always up-to-date with no manual maintenance. With a few minutes of effort, your platform team can gain visibility into **any repository**, regardless of the underlying technology or build system.

## From Reactive to Proactive Architecture Management

At the top of this post, I asked you how well you understood the code structure of your entire company. How well do you understand the connections between different projects in your company?

**Without understanding those connections, you're naturally reactive to problems.** A problem occurs and you're forced to immediately respond to it because you didn't see it coming.

With Workspace Graph and Polygraph as part of Nx Cloud, you can be **proactive**. You can see the impact of a change and get ahead of any problem that might occur. And you're able to do all of this in one place without external tools like spreadsheets to track dependencies between different projects.

## Key Benefits for Your Organization

- **Eliminate Spreadsheet Dependency Tracking** - No more maintaining manual lists of which applications depend on which libraries. Workspace Graph automatically discovers and visualizes these relationships.

- **Impact Analysis Made Simple** - Before making breaking changes to a shared library, instantly see all the applications and repositories that will be affected.

- **Architecture Decision Support** - When planning refactors or migrations, understand the full scope of work by seeing all connected repositories and projects.

- **Team Coordination** - Help teams understand how their work connects to other parts of the organization, improving collaboration and reducing surprises.

This is just the beginning for the power of Workspace Graph within Polygraph tools. We're really excited to build even more functionality on top of this vital context of dependencies between repositories.

## Available Today for Enterprise Customers

Workspace Graph is available now for all [Nx Enterprise](/enterprise) customers as part of the Polygraph suite. If you're an existing Enterprise customer, you can start using Workspace Graph immediately in your Nx Cloud dashboard.

The combination of universal repository support, automatic dependency discovery, and centralized visualization makes Workspace Graph essential for any organization managing multiple repositories.

{% call-to-action size="lg" title="Ready to see your organization's code structure?" url="/contact/sales" icon="nxcloud" description="Contact us to learn how Nx Enterprise and Workspace Graph can bring visibility to your entire organization." /%}

Workspace Graph transforms how you understand and manage your organization's codebase. No more flying blind when making changes. No more manual dependency tracking. Just clear, comprehensive visibility into how your code connects—exactly what you need to move from reactive to proactive development.

Learn more:

- 📄 [Workspace Graph Documentation](/ci/recipes/enterprise/polygraph#workspace-graph)
- 📄 [More about Polygraph](/blog/nx-cloud-introducing-polygraph)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx Enterprise](/enterprise)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
