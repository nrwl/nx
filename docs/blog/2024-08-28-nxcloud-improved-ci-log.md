---
title: New Table Log View on CI with Nx Cloud
slug: improved-ci-log-with-nx-cloud
authors: ['Juri Strumpflohner']
tags: [nx-cloud, release]
cover_image: /blog/images/2024-08/nx-cloud-table-log-output-thumb.jpg
youtubeUrl: https://youtu.be/aacrw0H0m4Q
---

Whenever we talk about Nx Cloud, speed is often a major focus—and for good reason. However, Nx Cloud isn't just about speed. Similar to Nx itself, it's about making work within monorepos more pleasant and efficient. A key part of that is continuously **optimizing developer ergonomics**.

Structuring your log output is one example. In a polyrepo setup, this isn't a big deal since you typically run tasks for a single project. However, in a monorepo setup, you might be running hundreds of tasks in parallel across multiple projects. **Quickly finding a failed task in this context can be challenging.**

## New Table Log View

Today, we released an update that improves how logs are displayed on your CI provider when using Nx Cloud. Instead of streaming all logs directly into your CI provider's pipeline, **we now render a structured table view**. This table shows all tasks, their status (success or failure), timing, and whether they had a cache hit or miss.

![New Table Log View](/blog/images/2024-08/circle-table-log-view.avif)

At the end of the log output, you'll also see aggregated stats about executed tasks, cache hits, and a link to the Nx Cloud dashboard with full details of the run.

![Nx Cloud Dashboard](/blog/images/2024-08/nx-cloud-dashboard-log-view.avif)

## Revert to the Old Behavior

If you prefer the previous log view in your CI, you can opt-out of the new table view. Simply go to your Nx Cloud workspace settings and enable the "Display live terminal outputs in CI pipeline log" option.

![](/blog/images/2024-08/nxcloud-display-live-terminal-output.avif)

## Not Using Nx Cloud Yet?

If you're not on Nx Cloud yet, you can **connect your Nx workspace** by running:

```shell
npx nx connect
```

This command will guide you through the setup. We recently introduced a [new Hobby plan](/pricing), which lets you experiment with all the Nx Cloud features for free. This is a great way to see if it's a good fit for your team.

## Learn More

- [Nx on CI](/ci)
- [Task Distribution with Nx Agents](/ci/features/distribute-task-execution)
- [Automated e2e Test Splitting](/ci/features/split-e2e-tasks)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
