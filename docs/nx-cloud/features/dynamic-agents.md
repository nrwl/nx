# Dynamically Allocate Agents

{% callout type="info" title="Coming soon!" %}
We're cooking something up that will make it even easier to dynamically allocate agents, powered by AI. [Read more &raquo;](/ci/concepts/nx-cloud-ai)
{% /callout %}

By default, when you set up [Nx Agents](/ci/features/distribute-task-execution) you specify the number and type of agents to use.

```yaml {% fileName=".github/workflows/main.yaml" highlightLines=[8] %}
...
jobs:
  - job: main
    displayName: Main Job
    ...
    steps:
      ...
      - run: npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js" --stop-agents-after="e2e-ci"
      - ...
```

This works great but may not be the most cost-effective way to run your tasks. The goal is to **balance cost and speed**. For example, you might want to run a small PR on a few agents to save costs, but use many agents for a large PR to get the fastest possible build time.

## Configure Dynamic Agents based on PR size

Instead of using a static configuration of agents (like the one shown above), you can also configure to use a different number and type of agents based on the size of your PR.

Create a file called `dynamic-changesets.yaml` in the `.nx/workflows` directory of your repo.

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 6 linux-medium-js
  large-changeset: 10 linux-medium-js
```

{% callout type="deepdive" title="How is the size of the PR determined?" %}
To determine the size of the PR, Nx Cloud calculates the relationship between the number of [affected projects](/ci/features/affected) and the total number of projects in the workspace. It then assigns it to one of the three categories: small, medium, or large.
{% /callout %}

You can then reference it in your CI pipeline configuration:

```yaml {% fileName=".github/workflows/main.yaml" highlightLines=[8] %}
...
jobs:
  - job: main
    displayName: Main Job
    ...
    steps:
      ...
      - run: npx nx-cloud start-ci-run --distribute-on=".nx/workflows/dynamic-changesets.yaml" --stop-agents-after="e2e-ci"
      - ...
```

Now, PRs that affect a small percentage of the repo will run on 3 agents, mid-size PRs will use 6 agents, and large PRs will use 10 agents. This feature helps save costs on smaller PRs while maintaining the high performance necessary for large PRs.
