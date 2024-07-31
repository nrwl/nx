---
title: 'Introducing Nx Cloud 2.0'
slug: 'introducing-nx-cloud-2-0'
authors: ['Brandon Roberts']
cover_image: '/blog/images/2021-06-09/0*nygtBNy1HVP4ZAHk.png'
tags: [nx, release]
---

Introducing Nx Cloud 2.0 — a cloud companion for your [Nx](https://nx.dev) monorepo helping ensure you are enabling your teams to work as efficiently as possible.

This new version of Nx Cloud provides:

- Faster local development using Zero-Config Distributed Caching
- Faster CI using Zero-Config Distributed Task Execution
- GitHub integration for glanceable information
- Insights into measuring your development workflow over time.

## **Distributed Task Execution**

![](/blog/images/2021-06-09/0*7zNXci4baO5Xia27.avif)

When working in large codebases, running tasks based on what is affected is a significant time-saver. However, there are some scenarios where you do need to run many tasks based on changes to the source code. There is a natural progression to this process. You start with running tasks locally on your individual machine. When that becomes a bottleneck, you run tasks in parallel locally. When you have a large Continuous Integration(CI) pipeline, it becomes much more efficient to distribute those tasks to run in parallel across multiple machines.

Traditionally, you might set up a parent job to split your tasks such as linting and testing into “buckets” and use child jobs to run each bucket of tasks, each with its own task details. Even in basic cases, like running tests, this turns into a challenging and ongoing effort and is simply not possible for cases where tasks depend on each other such as executing builds.

Nx Cloud solves this problem with Distributed Task Execution (DTE). DTE provides a Zero-Config️ integration with Nx Cloud that coordinates and schedules all the tasks created through Nx, executes them across multiple machines, and collects the results from these tasks into a single run.

You get a clean, consolidated view of all tasks run and their details in your Nx Cloud run details. Scaling up your CI infrastructure to parallelize even more tasks becomes as simple as adding more agents to listen for tasks.

## **Distributed Caching**

![](/blog/images/2021-06-09/0*RFEruPo843tiJ9em.avif)

Working efficiently inside a monorepo involves minimizing the amount of code you write and run, along with maximizing the amount of code that you share. When there are multiple groups of developers working inside the same space, they tend to run the same tasks repeatedly against the same set of files. Nx is smart in that it detects which projects were affected by a given change, and only runs the necessary tasks for those changes, such as building, testing, and linting.

Nx also caches the results on these tasks based on the source code and the context. This saves time and gives developers the ability to work faster towards shipping features, knowing that they don’t have to spend time waiting on all possible tasks to complete.

Nx Cloud builds on top of this feature and provides a low-configuration, global cache available to everyone in your organization. With Nx Cloud, the same cached commands and artifacts available to developers locally, is pushed up to Nx Cloud, so when developers finish their changes, open a pull request and push them to run in the Continuous Integration pipeline, the cache is already populated, decreasing CI time as those tasks don’t have to be re-run. This saves time, and scales across your entire organization, allowing your developers to verify and ship features quicker.

## **GitHub Integration**

CI environments are a necessity to keep the development pipeline flowing, but are not the best place to dig for information when your pull request tasks are complete. It usually involves clicking a link that takes you to a minimalistic page with lots of text to scroll through. When you just want to see what tasks were run with Nx, along with the results of those projects, this can slow down your feedback loop. Nx Cloud provides integration with GitHub that connects your Nx Cloud information to your pull requests.

![](/blog/images/2021-06-09/0*SSvYNNHgrxaC3io3.avif)

This integration gives you:

- Actionable result from each PR with its associated set of runs
- Quick links to jump to any particular task that succeeded or failed.
- Direct access to see commands and terminal outputs for each individual command without ever visiting your CI dashboard.

![](/blog/images/2021-06-09/0*DEBUlKNNgapopEbr.avif)

Visit the [Nx Cloud GitHub integration page](https://github.com/marketplace/official-nx-cloud-app) for more details:

## **Insights**

Nx Cloud also gives you valuable insights about your workspace. Find out exactly how much time you’re saving with Nx Cloud using the Cache Stats graph. This can be used to measure your CI performance over time, and look for potential bottlenecks.

![](/blog/images/2021-06-09/0*MVc1580YGm6XD1LS.avif)

View information about tasks using the run details view. Individual runs are displayed along with results, cache hits or misses, and associated terminal logs.

![](/blog/images/2021-06-09/0*6BX0pY_CQEFGiCut.avif)

## **Getting Started**

Getting started with Nx Cloud is as quick as connecting your existing Nx 12.x workspace to Nx Cloud.

```
nx connect-to-nx-cloud
```

\> For Nx workspaces prior to version 12:

Installing with `yarn`

```shell
yarn add [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud) && yarn nx g [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud):init
```

Installing with `npm`

```shell
npm install [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud) && npx nx g [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud):init
```

Next, click the provided link to connect your workspace to Nx Cloud.

This gives you a fully hosted/managed Nx Cloud organization to use. View your run details, cache stats, and other information without additional infrastructure.

We also have [**Nx Private Cloud**](https://nx.app/private-cloud) that can be deployed internally within our organization with the same assurances and security of the hosted/managed Nx Cloud provided by [Nrwl](https://nrwl.io).

Visit [nx.app](https://nx.app) to learn more about Nx Cloud and how it can enhance your usage of Nx.
