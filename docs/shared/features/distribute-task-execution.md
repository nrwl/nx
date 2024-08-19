# Distribute Task Execution (Nx Agents)

{% youtube
src="https://youtu.be/XS-exYYP_Gg"
title="Nx Agents Walkthrough"
/%}

Applying [Nx Affected](/ci/features/affected) and [remote caching](/ci/features/remote-cache) can significantly speed up your CI pipeline, but you might still hit limits. As your monorepo grows, the most effective way to maintain low CI times is by combining them with a **smart strategy for parallelizing work across multiple machines**. Manually setting up such distribution can be challenging, though, often resulting in suboptimal performance or requiring high maintenance over time.

![Nx Cloud visualization of how tasks are being distributed with Nx Agents](/shared/features/nx-agents-live-chart.avif)

Nx Agents offers several key advantages:

- **Declarative Configuration:** No maintenance is required as your monorepo evolves, thanks to a declarative setup.
- **Efficient Task Replay:** By leveraging [remote caching](/ci/features/remote-cache), tasks can be replayed efficiently across machines, enhancing distribution speed.
- **Intelligent Task Distribution:** Tasks are distributed based on historical run times and dependencies, ensuring correct and optimal execution.
- **Dynamic Resource Allocation:** Agents are [allocated dynamically based on the size of the PR](/ci/features/dynamic-agents), balancing cost and speed.
- **Seamless CI Integration:** Easily adopt Nx Agents with your [existing CI provider](/ci/recipes/set-up), requiring minimal setup changes.
- **Simple Activation:** Enable distribution with just a [single line of code](#enable-nx-agents) in your CI configuration.

## Enable Nx Agents

To enable task distribution with Nx Agents, make sure your Nx workspace is connected to Nx Cloud. If you haven't connected your workspace to Nx Cloud yet, run the following command:

```shell
npx nx connect
```

Also, check [connect to Nx Cloud recipe](/ci/intro/connect-to-nx-cloud) for all the details.

Then, adjust your CI pipeline configuration to **enable task distribution**. If you don't have a CI config yet, you can generate a new one using the following command:

```shell
npx nx g ci-workflow
```

The key line in your CI config is the `start-ci-run` command:

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=[13] %}
name: CI
...

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      ...
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - run: pnpm dlx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

      # Cache node_modules
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      ...

      # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
      - run: pnpm exec nx affected -t lint test build
```

This command tells Nx Cloud to:

- start a CI run `start-ci-run`
- take all Nx commands that are being issued (e.g., `pnpm exec nx affected -t lint test build`) and
- distribute them across 3 agents (`3 linux-medium-js`) where `linux-medium-js` is a predefined agent [launch template](/ci/reference/launch-templates).

### Configure Nx Agents on your CI Provider

Every organization manages their CI/CD pipelines differently, so the guides don't cover org-specific aspects of CI/CD (e.g., deployment). They mainly focus on configuring Nx correctly using Nx Agents and [Nx Replay](/ci/features/remote-cache).

- [Azure Pipelines](/ci/recipes/set-up/monorepo-ci-azure)
- [Circle CI](/ci/recipes/set-up/monorepo-ci-circle-ci)
- [GitHub Actions](/ci/recipes/set-up/monorepo-ci-github-actions)
- [Jenkins](/ci/recipes/set-up/monorepo-ci-jenkins)
- [GitLab](/ci/recipes/set-up/monorepo-ci-gitlab)
- [Bitbucket Pipelines](/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines)

## How Nx Agents Work

![Distribute Task Execution with Nx Agents](/shared/images/dte/nx-agents-orchestration-diagram.svg)

**Nx Agents is declarative** in that you only specify the number of agents and the type of agent you want to use. Nx Cloud then automatically picks up the Nx commands that are being issued on your CI and distributes them automatically. This results in **low maintenance and a much more efficient distribution**. A non-declarative approach would be one where you define which tasks or projects get executed on which machine, requiring you to adjust the configuration as your codebase changes.

**Nx Agents uses a task-centric approach** to distribution. Instead of defining which tasks run on which machine upfront, Nx Agents dynamically processes tasks based on availability and task dependencies/ordering. Imagine a stack of tasks that agents pick up based on their required processing time (from historical data) and task dependency/ordering (from the Nx graph). Not only is this more resource efficient, but it is also more resilient to failures since any other agent can pick up work if one agent fails during bootup. This method contrasts with traditional VM-centric approaches, where tasks must be predefined for specific machines, often leading to inefficiencies as your codebase grows. Read more [on our blog post](/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness).

**Nx Agents is cost and resource-efficient** as it automatically distributes tasks **optimizing for speed while also ensuring resource utilization is high** and idle time is low. You can also [dynamically adjust the number of agents](/ci/features/dynamic-agents) based on the size of the PR, and we're working on [some more AI-powered features](/ci/concepts/nx-cloud-ai) to optimize this even further. In addition, [remote caching](/ci/features/remote-cache) guarantees tasks are not run twice, and artifacts are shared efficiently among agents.

**Nx Agents is non-invasive** in that you don't need to completely overhaul your existing CI configuration or your Nx workspace to use it. You can start using it with your existing CI provider by adding the `nx-cloud start-ci-run...` command mentioned previously. In addition, all artifacts and logs are played back to the main job so you can keep processing them as if they were run on the main job. Hence, your existing post-processing steps should still keep working as before.

For a more thorough explanation of how Nx Agents optimize your CI pipeline, read this [guide to parallelization and distribution in CI](/ci/concepts/parallelization-distribution).

## Nx Agents Features

{% cards %}

{% card title="Create Custom Launch Templates" description="Define your own launch templates to set up agents in the exact right way" type="documentation" url="/ci/reference/launch-templates" /%}

{% card title="Dynamically Allocate Agents" description="Assign a different number of agents to a pipeline based on the size of the PR" type="documentation" url="/ci/features/dynamic-agents" /%}

{% card title="Automatically Split E2E Tasks" description="Split large e2e tasks into a separate task for each spec file" type="documentation" url="/ci/features/split-e2e-tasks" /%}

{% card title="Identify and Re-run Flaky Tasks" description="Re-run flaky tasks in CI whenever they fail" url="/ci/features/flaky-tasks" /%}

{% /cards %}

## Relevant Repositories and Examples

By integrating Nx Agents into your CI pipeline, you can significantly reduce build times, optimize resource use, and maintain a scalable, efficient development workflow.

- [Reliable CI: A New Execution Model Fixing Both Flakiness and Slowness](https://nx.dev/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness)
- [Nx: On how to make your CI 16 times faster with a small config change](https://github.com/vsavkin/interstellar)
- ["Lerna & Distributed Task Execution" Example](https://github.com/vsavkin/lerna-dte)
