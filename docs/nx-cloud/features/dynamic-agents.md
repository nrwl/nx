# Dynamically Allocate Agents

The standard way to set up [Nx Agents](/ci/features/distribute-task-execution) is to use this flag:

```
--distribute-on="8 linux-medium-js"
```

...which always runs tasks on the same amount of machines, you can also have Nx Cloud scale the number of agents based on the size of your PR. Specify the number and type of agents to use for small, medium and large changesets by creating a yaml file like this:

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 6 linux-medium-js
  large-changeset: 10 linux-medium-js
```

{% callout type="note" title="How is the size of the PR determined?" %}
To determine the size of the PR, Nx Cloud calculates the relationship between the number of [affected projects](/ci/features/affected) and the total number of projects in the workspace. It then assigns it to one of the three categories: small, medium, or large.
{% /callout %}

You can then reference it in your CI pipeline configuration:

```yaml {% fileName=".github/workflows/main.yaml" %}
...
jobs:
  - job: main
    displayName: Main Job
    ...
    steps:
      - checkout
      - run: npx nx-cloud start-ci-run --distribute-on=".nx/workflows/dynamic-changesets.yaml" --stop-agents-after="e2e-ci"
      - ...
```

Now PRs that affect a small percentage of the repo will run on 1 agent, mid-size PRs will use 6 agents and large PRs will use 10 agents. This feature helps save costs on the smaller PRs while maintaining the high performance necessary for large PRs.
