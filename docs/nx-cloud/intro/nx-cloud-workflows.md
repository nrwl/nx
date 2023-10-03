# Nx Cloud Workflows

{% youtube
src="https://www.youtube.com/embed/IQ5YyEYZw68?start=3371"
title="Introducing Nx Cloud Workflows"
width="100%" /%}

## Powerful CI Capabilities Optimized for Nx monorepos

Nx makes it easy for you to grow and maintain a monorepo.

Nx Cloud makes it easy to scale your CI pipelines.

Nx Cloud Workflows is the next step in that progression. Instead of having Nx Cloud manage agents on another CI provider, you can have Nx Cloud _be_ your CI provider.

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

If you are interested in being one of the first organizations to experience Nx Cloud Workflows, contact [cloud-support@nrwl.io](mailto://cloud-support@nrwl.io).
