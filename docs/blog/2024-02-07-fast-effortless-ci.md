---
title: Fast, Effortless CI
slug: 'fast-effortless-ci'
authors: [Isaac Mann]
cover_image: '/blog/images/2024-02-07/featured_img.png'
tags: [nx, nx-cloud, release]
reposts: []
---

## From 90-minute to 10-minute CI Pipelines

{% youtube src="https://www.youtube.com/embed/_FSHQIwITic?si=GaAz4B0nYUEzVftN" title="Fast, Effortless CI" /%}

> TL;DR; Nx is releasing a new product called Nx Agents that dramatically improves the speed and maintainability of your CI pipeline.

In 2014, the state of the art for running tests and builds in your repository were tools like Gulp and Grunt. They were good enough to get the job done, but they were fundamentally **low-level** build tools. That is, they did exactly what they were programmed to do and no more. That approach works well in a single project where the configuration does not change frequently, but becomes problematic in a monorepo environment where there are multiple applications and multiple teams working in the same repository.

Nx was created in 2017 to address this problem. Nx is a build system that operates on a **higher level** where developers define the relationships between tasks and then Nx to decides the optimal way to run those tasks. In the same way, developers can define the inputs and outputs of tasks, then Nx automatically caches those task results. Developers tell Nx what a task does and then Nx can decide how best to run that task.

With [Nx Agents](/ci/features/distribute-task-execution), Nx is applying this same mindset to the problem of slow and costly CI pipelines. Nx gives you both **Smart Monorepos** and **Fast CI**.

## Why is CI So Hard?

Just like build tools from the last decade, CI pipelines are defined in a low-level, machine-oriented way. Each step in the pipeline is defined explicitly. It is up to the CI developer to ensure that all pre-requisites are available for each new step in the pipeline. If tasks need to be run in parallel on multiple machines, all the assets needed by each of those tasks need to be copied over to those machines before the tasks are run. Then, if the task dependencies ever change, the CI pipeline configuration needs to be updated to account for those changes.

The script below is a very simple example with only three tasks and one file being shared between them, but you can already see the complexity inherent in the system.

```yaml
jobs:
  build_base:
    steps:
      - run: npm run build-base
      - name: Save assets for use by other jobs
        uses: actions/upload-artifact@v4
        with:
          name: base_output
          path: base/output.ts

  build_app1:
    needs: build_base
    steps:
      - name: Download base output
        uses: actions/download-artifact@v4
        with:
          name: base_output
      - run: npm run build-app1

  build_app2:
    needs: build_base
    steps:
      - name: Download base output
        uses: actions/download-artifact@v4
        with:
          name: base_output
      - run: npm run build-app2
```

At any point in the future, if a task is added to the system or there is a change to the output files of build_base, this pipeline will need to be updated.

## A Build System That Runs Your CI

Part of the reason CI is so difficult to maintain is that it has no knowledge of your repository. Your CI provider can’t optimize your pipeline because it doesn’t even know the language you’re using, let alone relationships between your projects. A build system, on the other hand, must know all that information in order to properly function.

The key that unlocks all the power of Nx Agents is this architectural shift:

> Rather than the traditional approach where your CI provider invokes a build tool, the Nx build system will manage your CI pipeline.

Nx already knows how your repository is structured and the best way to run tasks locally. Nx can use that exact same knowledge to run tasks in the best way on multiple machines in CI.

## Distribute Tasks with Nx Agents

When using Nx Agents, distributing tasks across multiple machines becomes as simple as running those tasks on your local machine. This is because any task artifacts will automatically be copied to the agent machines where they are needed.

Instead of explicitly defining what order to run tasks, your CI pipeline only needs to tell Nx **what** needs to be accomplished and Nx will figure out **how** best to do it.

![](/blog/images/2024-02-07/bodyimg1.webp)

The pipeline configuration below will work no matter how many projects are in the repository or how complex the dependencies between those projects are.

```yaml
jobs:
  main:
    # Tell Nx Cloud how many agents to use and the name of the last task
    - run: |
        nx-cloud start-ci-run \
          --distribute-on="3 linux-medium-js" \
          --stop-agents-after="e2e-ci"
    # Run tasks the same way you would locally
    - run: nx affected -t lint test build --parallel=3
    - run: nx affected -t e2e-ci --parallel=1
```

The only reason to modify this file is if you need to change the number of agent machines or there is another type of task that needs to run in CI.

The `linux-medium-js` name in the CI configuration refers to a built-in launch template that Nx provides. If you can not find a template in [the default list](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml) that meets your needs, you can provide your own. [With a single yaml file](/ci/reference/launch-templates), you can set up your agent environment in exactly the way you want with your own launch template.

## Dynamically Allocate Agents

Nx understands that some CI pipelines need more resources than others. To account for this, Nx Agents gives you the ability to [define three different classes of agent allocation configurations](/ci/features/dynamic-agents). You can use fewer agents for smaller PRs and more agents for larger PRs. This allows you to save money where possible and use the full power of Nx Agents when needed.

![](/blog/images/2024-02-07/bodyimg2.webp)

## Automatically Split E2E Tasks by File

Typically, e2e tests are the tasks that take the longest in CI. In order to take advantage of parallelization and task distribution, these large tasks would need to be split into smaller tasks, but doing this manually would involve duplicating a lot of configuration code and making sure to keep that configuration synchronized. Nx 18’s [Project Crystal](/blog/what-if-nx-plugins-were-more-like-vscode-extensions) allows you to [automatically create separate Cypress and Playwright tasks](/ci/features/split-e2e-tasks) for each spec file in the e2e project. These individual tasks can all be triggered by running the `e2e-ci` task. What was once a tedious manual process can now be done for you automatically.

![](/blog/images/2024-02-07/bodyimg3.webp)

## Identify and Re-run Flaky Tasks

There are some tasks that will fail or succeed in CI without any changes to the task’s code. These are flaky tasks and in order to merge a change in unrelated code, developers need to manually re-run the entire pipeline until that flaky task succeeds. Because Nx is already tracking inputs and outputs of tasks, it knows when a task is flaky. Now, Nx Cloud will [automatically re-run a flaky task if it fails](/ci/features/flaky-tasks), without a developer needing to manually trigger it.

![](/blog/images/2024-02-07/bodyimg4.webp)

## Run Some Tasks on Another CI Provider

If you have a task that can’t be run on Nx Agents for some reason, you can easily [flag it to run directly on the main CI job](/ci/reference/nx-cloud-cli#enablingdisabling-distribution). Add a `--no-agents` flag to the command and Nx will not run it on an agent.

---

## Learn more

- [Nx Docs](/getting-started/intro)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](https://nx.app/)
