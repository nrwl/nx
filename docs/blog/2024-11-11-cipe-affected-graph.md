---
title: See your affected graph right on the CIPE
slug: cipe-affected-graph
authors: ['Philip Fulcher']
tags: [nx-cloud]
cover_image: /blog/images/2024-11-11/header.avif
---

As monorepos grow in size and complexity, it can be difficult to understand the relationships between different parts of
your codebase. That's why Nx has the [graph visualization](/features/explore-graph) that helps you see the different
connections between projects and tasks in your workspace. But that runs locally, and sometimes you need to see that same graph from your CI's perspective. Now you can do that with the CIPE affected graph in Nx Cloud.

## More insight into CI tasks

The CLI graph visualization can give you some information about what projects or tasks are affected by your changes. But
CI may run different tasks than you do locally, or compare to different branches for affected calculations. So you often
feel like you're passing your work off to a black box with no insight into why a project is marked as affected on CI.

## How do I use it?

The affected graph is available on all CI Pipeline Executions (CIPEs) in Nx Cloud. Click the new "Affected Graph" link at the top of your CIPE view.

![Screenshot of affected graph inside a CIPE on Nx Cloud](/blog/images/2024-11-11/screenshot.avif)

The CIPE graph uses the new [Composite Graph](/features/explore-graph#focusing-on-valuable-projects) introduced in Nx 20.
Groups of projects are collapsed into a single node on the graph based on directories. You can expand those nodes to see
inside by double-clicking them, or by clicking on the node and then clicking "Expand".

You can explore this example on your own on the
public [Nx OSS workspace](https://staging.nx.app/cipes/673137bc4c6704317ca09c7d/graph?runGroup=0ca224ea-1849-4f83-9ab9-68bec96bcb98-linux).

## Get started with Nx Cloud

Not an Nx Cloud user? You can get started today, for free!

{% call-to-action title="Get started with Nx Cloud" url="https://cloud.nx.app" icon="nxcloud" description="Try Nx Cloud for Free" %}
Get started with Nx Cloud
{% /call-to-action %}

## Learn more

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
