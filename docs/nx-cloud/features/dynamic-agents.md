# Dynamically Allocate Agents

By default, when you set up [Nx Agents](/ci/features/distribute-task-execution) you specify the number and type of agents to use.

```yaml {% fileName=".github/workflows/main.yaml" highlightLines=[8] %}
...
jobs:
  - job: main
    name: Main Job
    ...
    steps:
      ...
      - run: npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js" --stop-agents-after="e2e-ci"
      - ...
```

This works great, but may not be the most cost-effective way to run your tasks. The goal is to **balance cost and speed**. For example, you might want to run a small PR on a few agents to save costs, but use many agents for a large PR to get the fastest possible build time.

## Configure Dynamic Agents based on PR size

You can configure Nx Cloud to execute a different number of agents based on the size of your PR's affected changes. Define any number of **changesets** (the number of agents and types of agents) to use for different sized PRs and pass them in a configuration file to your `start-ci-run` command.

Start by creating a file called `distribution-config.yaml` in the `.nx/workflows` directory of your repo. This file will contain a `distribute-on` property that will be used to define the changesets to use for your PR. You can name your changesets anything you want.

{% callout type="warning" title="The order of your changesets matters!" %}
Define your changesets in order of increasing size (i.e. smallest changesets are defined before larger changesets). Nx Cloud uses the position of your changesets as part of its calculations to dynamically determine the correct changeset to use for your PR.
{% /callout %}

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 6 linux-medium-js
  large-changeset: 10 linux-medium-js
```

You can also specify a `default` changeset if you only want one changeset to be used for all PRs. Note that `default` is a reserved keyword so do not use it if you would like to define multiple changesets.

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  default: 3 linux-medium-js
```

You can have as many changesets as you want. Based on the number of changesets specified, each changeset is assigned an equal percentage out of 100. Nx Cloud can determine the percentage of affected projects in your PR and use that value to evaluate which changeset to use.

{% callout type="deepdive" title="How is the size of the PR determined?" %}
Nx Cloud calculates the relationship between the number of [affected projects](/ci/features/affected) and the total number of projects in the workspace to determine the size of a PR.
{% /callout %}

## Setting up Dynamic Agents in your CI Pipeline

In the example below, each changeset would be assigned an equal percentage range out of 100%. If Nx Cloud determines that 30% of your projects have been affected, then it will use the medium changeset to distribute the workload on. If Nx Cloud determines that 55% of your projects have been affected, it will use the large changeset.

```yaml {% fileName=".nx/workflows/distribution-config.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js # Distribute on small if 1-25% of projects affected in PR
  medium-changeset: 6 linux-medium-js # Distribute on medium if 26-50% of projects affected in PR
  large-changeset: 10 linux-medium-js # Distribute on large if 51-75% of projects affected in PR
  extra-large-changeset: 15 linux-medium-js # Distribute on extra-large if 76-100% of projects affected in PR
```

You can then reference your distribution configuration in your CI pipeline configuration:

```yaml {% fileName=".github/workflows/main.yaml" highlightLines=[8] %}
...
jobs:
  - job: main
    name: Main Job
    ...
    steps:
      ...
      - run: npx nx-cloud start-ci-run --distribute-on=".nx/workflows/distribution-config.yaml" --stop-agents-after="e2e-ci"
      - ...
```

Now your agents will distribute your tasks dynamically—scaling and adapting to your PR sizes.
This feature helps save costs on smaller PRs while maintaining the high performance necessary for large PRs.
