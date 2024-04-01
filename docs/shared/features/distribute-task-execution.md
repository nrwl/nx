# Distribute Task Execution (Nx Agents)

{% youtube
src="https://youtu.be/XS-exYYP_Gg"
title="Nx Agents Walkthrough"
 /%}

**Nx Agents** let you distribute your CI across many machines with minimal configuration. It also comes with the following features:

- [Dynamically allocate the number and size of agents](/ci/features/dynamic-agents) based on the size of the PR
- [Re-run flaky tasks](/ci/features/flaky-tasks) automatically whenever they fail in CI
- Automatically [split large e2e tasks](/ci/features/split-e2e-tasks) into smaller tasks that can be distributed more efficiently

## Making a Distributed CI Pipeline Is Hard

The only way to speed up your CI pipeline while still running all the necessary tasks is to distribute those tasks across multiple machines. Unfortunately, doing distribution right is hard to set up and hard to maintain. These are just some concerns you have to account for:

- Choose how many machines to set up
- Set up each machine so that it is ready to execute tasks
- Ensure that tasks are run in the correct order
- Copy the output of certain tasks to the machines where those outputs are needed
- Shut down machines when there are no more tasks to run
- Shut down all the machines when the whole pipeline hits an error
- Make sure sensitive information is being handled securely on all machines

And each of these concerns will need to be reconsidered whenever the codebase changes. It would actually be best if they were reconsidered for every PR, because small PRs may not need as much distribution as large PRs.

## Nx Agents Make Distributing Tasks Simple

Nx Agents take care of all these concerns with a small initial configuration that does not need to be modified as your codebase changes. Your CI pipeline sends your tasks to be run on agent machines that Nx Cloud creates for you. All you need to do is specify how many agents and the type of agent. Then, when the pipeline is finished, your initial CI pipeline will contain all the logs and artifacts as if the tasks all ran on your main CI machine - but completed in a fraction of the time.

![Distribute Task Execution with Nx Agents](/shared/images/dte/nx-agents-orchestration-diagram.svg)

For a more thorough explanation of how Nx Agents optimizes your CI pipeline, read this [guide to parallelization and distribution in CI](/ci/concepts/parallelization-distribution).

## Enable Nx Agents

To enable task distribution with Nx Agents, there are two requirements:

1. Enable version control system integration. The integrations currently available are [GitHub](/ci/recipes/source-control-integration/github), [GitLab](/ci/recipes/source-control-integration/gitlab), [Bitbucket](/ci/recipes/source-control-integration/bitbucket-cloud) and [Azure DevOps](/ci/recipes/source-control-integration/azure-devops). These integrations can be enabled from your [Nx Cloud dashboard](https://nx.app).
2. Add a single line to your CI pipeline configuration.

Add the `start-ci-run` command to your CI pipeline configuration after checking out the repository and before installing `node_modules`:

```yaml {% fileName=".github/workflows/main.yaml" %}
# After checkout repository
- name: Start CI run
  run: 'npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js"'
# Before install node_modules
# Run any nx commands as if running on a single machine
```

The `--distribute-on` flag instructs Nx Cloud to distribute tasks across 8 agents of type `linux-medium-js`. `linux-medium-js` is the name of the launch template that will be used to provision the agent. Use on of the [default launch templates](https://github.com/nrwl/nx-cloud-workflows/blob/main/launch-templates/linux.yaml) or create your own [custom launch template](/ci/reference/launch-templates).

## Nx Agents Features

{% cards %}

{% card title="Create Custom Launch Templates" description="Define your own launch templates to set up agents in the exact right way" type="documentation" url="/ci/reference/launch-templates" /%}

{% card title="Dynamically Allocate Agents" description="Assign a different number of agents to a pipeline based on the size of the PR" type="documentation" url="/ci/features/dynamic-agents" /%}

{% card title="Automatically Split E2E Tasks" description="Split large e2e tasks into a separate task for each spec file" type="documentation" url="/ci/features/split-e2e-tasks" /%}

{% card title="Identify and Re-run Flaky Tasks" description="Re-run flaky tasks in CI whenever they fail" url="/ci/features/flaky-tasks" /%}

{% /cards %}

## CI/CD Guides

Every organization manages their CI/CD pipelines differently, so the guides don't cover org-specific aspects of
CI/CD (e.g., deployment). They mainly focus on configuring Nx correctly using Nx Agents and [Nx Replay](/ci/features/remote-cache).

- [Azure Pipelines](/ci/recipes/set-up/monorepo-ci-azure)
- [Circle CI](/ci/recipes/set-up/monorepo-ci-circle-ci)
- [GitHub Actions](/ci/recipes/set-up/monorepo-ci-github-actions)
- [Jenkins](/ci/recipes/set-up/monorepo-ci-jenkins)
- [GitLab](/ci/recipes/set-up/monorepo-ci-gitlab)
- [Bitbucket Pipelines](/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines)

Note that only cacheable operations can be distributed because they have to be replayed on the main job.

## Relevant Repositories and Examples

- [Nx: On how to make your CI 16 times faster with a small config change](https://github.com/vsavkin/interstellar)
- ["Lerna & Distributed Task Execution" Example](https://github.com/vsavkin/lerna-dte)
