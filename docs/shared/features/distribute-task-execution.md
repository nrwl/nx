# Distribute Task Execution (Nx Agents)

{% youtube
src="https://youtu.be/XLOUFZeqRpM"
title="Nx Agents in action splitting e2e tests at a file level"
 /%}

**Nx Agents** lets you distribute your CI across many machines with minimal configuration. It comes with features such as dynamically allocating agents based on the size of the PR, flaky task re-running, and intelligent task splitting and distribution. Keep reading to learn more.

![Distribute Task Execution with Nx Agents](/shared/images/dte/nx-agents-orchestration-diagram.svg)

For a more thorough explanation of how Nx Agents optimizes your CI pipeline, read this [guide to parallelization and distribution in CI](/ci/concepts/parallelization-distribution).

## Enabling Nx Agents

To enable task distribution with Nx Agents, there are two requirements:

1. Enable version control system integration. The integrations currently available are [GitHub](/ci/recipes/source-control-integration/github), [GitLab](/ci/recipes/source-control-integration/gitlab) and [Bitbucket](/ci/recipes/source-control-integration/bitbucket-cloud). These integrations can be enabled from your [Nx Cloud dashboard](https://nx.app).
2. Add a single line to your CI pipeline configuration.

Add the `start-ci-run` command to your CI pipeline configuration after checking out the repository and before installing `node_modules`:

```yaml {% fileName=".github/workflows/main.yaml" %}
# After checkout repository
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js" --stop-agents-after="e2e-ci"'
# Before install node_modules
# Run any nx commands as if running on a single machine
```

The `--distribute-on` flag instructs Nx Cloud to distribute tasks across 8 agents of type `linux-medium-js`. `linux-medium-js` is the name of the launch template that will be used to provision the agent. The default launch templates [can be found here](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml)

## Launch Templates

You can also define your own "launch templates" (here's an [example from the Nx repo](https://github.com/nrwl/nx/blob/master/.nx/workflows/agents.yaml)):

```yaml {% fileName=".nx/workflows/agents.yaml" %}
launch-templates:
  linux-medium:
    resource-class: 'docker_linux_amd64/medium+'
    init-steps:
      - name: Pnpm Install
        script: |
          pnpm install --frozen-lockfile

      - name: Install Cypress
        script: pnpm exec cypress install

      - name: Install Rust
      - ...
```

Here are the [available resource classes](https://nx.app/pricing#resource-classes).

## Intelligent Dynamic Scaling

Instead of defining

```
--distribute-on="8 linux-medium-js"
```

...which always runs tasks on the same amount of machines, you can also have Nx Cloud scale the number of agents based on the size of your PR.

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 1 linux-medium-js
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

## Related Features

{% cards %}

{% card title="Automatically Split E2E Tasks" description="Split large e2e tasks into separate tasks for each spec file" type="documentation" url="/ci/concepts/split-e2e-tasks" /%}

{% card title="Identify and Re-run Flaky Tasks" description="Re-run flaky tasks in CI whenever they fail" url="/ci/concepts/flaky-tasks" /%}

{% /cards %}

## CI/CD Guides

Every organization manages their CI/CD pipelines differently, so the guides don't cover org-specific aspects of
CI/CD (e.g., deployment). They mainly focus on configuring Nx correctly using Nx Agents and [Nx Replay](/ci/features/remote-cache).

- [Azure Pipelines](/ci/recipes/set-up/monorepo-ci-azure#distributed-ci-with-nx-cloud)
- [Circle CI](/ci/recipes/set-up/monorepo-ci-circle-ci#distributed-ci-with-nx-cloud)
- [GitHub Actions](/ci/recipes/set-up/monorepo-ci-github-actions#distributed-ci-with-nx-cloud)
- [Jenkins](/ci/recipes/set-up/monorepo-ci-jenkins#distributed-ci-with-nx-cloud)

Note that only cacheable operations can be distributed because they have to be replayed on the main job.

## Relevant Repositories and Examples

- [Nx: On how to make your CI 16 times faster with a small config change](https://github.com/vsavkin/interstellar)
- ["Lerna & Distributed Task Execution" Example](https://github.com/vsavkin/lerna-dte)
