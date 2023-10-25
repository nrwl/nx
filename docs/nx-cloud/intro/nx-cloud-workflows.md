# Nx Cloud Workflows

{% youtube
src="https://www.youtube.com/embed/JG1FWfZFByM"
title="Introducing Nx Cloud Workflows"
width="100%" /%}

## Powerful CI Capabilities Optimized for Nx monorepos

Just like Nx and Nx Cloud, Nx Cloud Workflows enables you to offload tedious technical tasks so that you can focus on more mission-critical tasks. With a traditional CI platform, you are responsible for telling the CI platform exactly what commands to execute in which environments and what to do with the artifacts. Nx Cloud by itself can automate parallelizing tasks and sharing build artifacts across machines, but you still have to create agent machines on your CI platform.

Nx Cloud Workflows applies the insights that Nx provides to the entire CI process - taking Nx Cloud to its logical conclusion by managing the whole process of CI. Nx Cloud Workflows dynamically provisions agents and then automatically parallelizes tasks and shares build artifacts across them. Because Nx Cloud Workflows can integrate directly with Nx, it has the potential to solve problems that a traditional CI platform has no way of addressing.

## Better Distributed Task Execution Experience

Nx Cloud's Distributed Task Execution (DTE) requires you to provision agent processes on your own CI provider and then Nx Cloud takes care of distributing tasks across those agents and then consolidating the results of those tasks afterwards.

![Diagram showing Nx Cloud distributing tasks to multiple agents](/shared/images/dte/distributed-caching-and-task-execution.svg)

When Nx Cloud Workflows is used for DTE, Nx Cloud will dynamically provision the agents needed for each run. This cuts down on the configuration needed and allows your organization to pay one bill to Nx instead of paying both Nx and your CI provider.

![Diagram showing Nx Cloud distributing tasks to multiple Nx Cloud Workflows agents](/shared/images/dte/distributed-task-execution-on-workflows.svg)

## Familiar YAML Syntax

Defining your CI pipeline in Nx Cloud Workflows should feel similar to the way your current CI pipelines are defined.

```yaml {% fileName=".nx/workflows/" %}
parallelism: 8
env:
  CI: 'true'
  NX_CLOUD_ACCESS_TOKEN: '{{secrets.NX_CLOUD_ACCESS_TOKEN}}'
steps:
  - name: Git Clone
    script: |
      git init .
      git remote add origin $GIT_REPOSITORY_URL
      git fetch --no-tags --prune --depth=1 origin +{{nxCommitSha}}:{{nxCommitRef}}
      git checkout --force -B {{nxBranch}} {{nxCommitRef}}

  - name: Npm Install
    script: |
      npm ci

  - name: Run Agent
    script: |
      npx nx-cloud start-agent
```

## Security

You have the choice between an on-premise setup or using the hosted version of Nx Cloud Workflows. The hosted version of Nx Cloud Workflows uses gVisor to ensure that each container is sandboxed in a virtualized environment so your build system is protected from attackers. gVisor is the same tool that is used to protect Google Cloud Functions.

## Early Access

If you are interested in being one of the first organizations to experience Nx Cloud Workflows, you can [sign up for early access](https://cloud.nx.app/workflows-early-access).
