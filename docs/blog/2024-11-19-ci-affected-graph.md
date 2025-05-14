---
title: See your affected project graph in Nx Cloud
slug: ci-affected-graph
authors: ['Philip Fulcher']
tags: [nx-cloud]
cover_image: /blog/images/2024-11-19/header.avif
youtubeUrl: https://youtu.be/TS-Fp2iSlVM
description: Nx Cloud's affected project graph visualization helps you understand CI impacts on projects and tasks, providing insight into monorepo dependencies.
---

As monorepos grow in size and complexity, it can be difficult to understand the relationships between different parts of
your codebase. That's why Nx has the [graph visualization](/features/explore-graph) that helps you see the different
connections between projects and tasks in your workspace. But that runs locally, and sometimes you need to see that same graph from your CI's perspective. Now you can do that with the affected project graph in Nx Cloud.

## More insight into CI tasks

The CLI project graph visualization can give you some information about what projects or tasks are affected by your changes. But
CI may run different tasks than you do locally, or compare to different branches for affected calculations. So you often
feel like you're passing your work off to a black box with no insight into why a project is marked as affected on CI.

What do we mean by "marked as affected?" In a monorepo, running all your tasks, all the time, quickly becomes untenable. You'll either be wasting time waiting for tasks to finish, or spending a fortune on runners powerful enough to run in a timely manner. Instead, Nx analyzes the structure of your workspace and understands the relationship between different projects. When you run [`affected`](/ci/features/affected) tasks, it traces the projects that are actually affected by the change. For example, if you've made changes to a single app, Nx only marks that app as affected and doesn't run tasks for any other app.

## How do I use it?

The affected project graph is available on all CI Pipeline Executions (CIPEs) in Nx Cloud. Click the new "Affected Project Graph" link at the top of your CIPE view.

![Screenshot of CI affected project graph on Nx Cloud](/blog/images/2024-11-19/screenshot.avif)

The affected project graph uses the new [Composite Graph](/features/explore-graph#focusing-on-valuable-projects) introduced in Nx 20.
Groups of projects are collapsed into a single node on the graph based on directories. You can expand those nodes to see
inside by double-clicking them, or by clicking on the node and then clicking "Expand".

You can explore affected project graphs on your own on the
public [Nx OSS workspace](https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview).

We've put together an example of one problem you can solve using this new view: [reducing the number of affected projects on CI](/ci/recipes/other/cipe-affected-project-graph).

## Get started with Nx Cloud

Not an Nx Cloud user? You can get started today, for free!

{% call-to-action title="Get started with Nx Cloud" url="/nx-cloud" icon="nxcloud" description="Try Nx Cloud for Free" %}
Get started with Nx Cloud
{% /call-to-action %}

## Learn more

- [Recipe: Reduce the Number of Affected Projects in a CI Pipeline Execution](/ci/recipes/other/cipe-affected-project-graph)
- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools)
- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
