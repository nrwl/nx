# Configuring CI Using Azure Pipelines and Nx

Nx is a smart, fast and extensible build system, and it works really well with monorepos. Monorepos provide a lot of advantages:

- Everything at that current commit works together. Changes can be verified across all affected parts of the organization.
- Easy to split code into composable modules
- Easier dependency management
- One toolchain setup
- Code editors and IDEs are "workspace" aware
- Consistent developer experience
- And more ...

But they come with their own technical challenges. The more code you add into your repository, the slower the CI gets. Adding Nx to your CI pipeline makes this more efficient.

## Setting up Azure Pipelines

Below is an example of an Azure Pipelines setup for an Nx workspace only building and testing what is affected.

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag a SHA in the main job once it succeeds, and then use this tag as a base. See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repos for more information.

We also have to set `NX_BRANCH` explicitly.

```yaml
trigger:
  - main
pr:
  - main

variables:
  CI: 'true'
  ${{ if eq(variables['Build.Reason'], 'PullRequest') }}:
    NX_BRANCH: $(System.PullRequest.PullRequestNumber)
    TARGET_BRANCH: $[replace(variables['System.PullRequest.TargetBranch'],'refs/heads/','origin/')]
    BASE_SHA: $(git merge-base $(TARGET_BRANCH) HEAD)
  ${{ if ne(variables['Build.Reason'], 'PullRequest') }}:
    NX_BRANCH: $(Build.SourceBranchName)
    BASE_SHA: $(git rev-parse HEAD~1)
  HEAD_SHA: $(git rev-parse HEAD)

jobs:
  - job: main
    pool:
      vmImage: 'ubuntu-latest'
    steps:
      - script: npm ci

      - script: npx nx workspace-lint
      - script: npx nx format:check

      - script: npx nx affected --base=$(BASE_SHA) --target=lint --parallel=3
      - script: npx nx affected --base=$(BASE_SHA) --target=test --parallel=3 --ci --code-coverage
      - script: npx nx affected --base=$(BASE_SHA) --target=build --parallel=3
```

The `main` job implements the CI workflow.

## Distributed CI with Nx Cloud

A computation cache is created on your local machine to make the developer experience faster. This allows you to not waste time re-building, re-testing, re-linting, or any number of other actions you might take on code that hasn't changed. Because the cache is stored locally, you are the only member of your team that can take advantage of these instant commands. You can manage and share this cache manually.

Nx Cloud allows this cache to be shared across your entire organization, meaning that any cacheable operation completed on your workspace only needs to be run once. Nx Cloud also allows you to distribute your CI across multiple machines to make sure the CI is fast even for very large repos.

In order to use distributed task execution, we need to start agents and set the `NX_CLOUD_DISTRIBUTED_EXECUTION` flag to `true`. Once all tasks are finished, we must not forget to cleanup used agents.

```yaml
trigger:
  - main
pr:
  - main

variables:
  CI: 'true'
  NX_CLOUD_DISTRIBUTED_EXECUTION: 'true'
  ${{ if eq(variables['Build.Reason'], 'PullRequest') }}:
    NX_BRANCH: $(System.PullRequest.PullRequestNumber)
    TARGET_BRANCH: $[replace(variables['System.PullRequest.TargetBranch'],'refs/heads/','origin/')]
    BASE_SHA: $(git merge-base $(TARGET_BRANCH) HEAD)
  ${{ if ne(variables['Build.Reason'], 'PullRequest') }}:
    NX_BRANCH: $(Build.SourceBranchName)
    BASE_SHA: $(git rev-parse HEAD~1)
  HEAD_SHA: $(git rev-parse HEAD)

jobs:
  - job: agents
    strategy:
      parallel: 3
    displayName: Nx Cloud Agent
    pool:
      vmImage: 'ubuntu-latest'
    steps:
      - script: npm ci
      - script: npx nx-cloud start-agent

  - job: main
    displayName: Nx Cloud Main
    pool:
      vmImage: 'ubuntu-latest'
    steps:
      - script: npm ci
      - script: npx nx-cloud start-ci-run

      - script: npx nx-cloud record -- npx nx workspace-lint
      - script: npx nx-cloud record -- npx nx format:check --base=$(BASE_SHA) --head=$(HEAD_SHA)
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) --target=lint --parallel=3
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) --target=test --parallel=3 --ci --code-coverage
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) --target=build --parallel=3

      - script: npx nx-cloud stop-all-agents
        condition: always()
```

You can also use our [ci-workflow generator](https://nx.dev/packages/workspace/generators/ci-workflow) to generate the pipeline file.

Learn more about [configuring your CI](https://nx.app/docs/configuring-ci) environment using Nx Cloud with [Distributed Caching](https://nx.app/docs/distributed-caching) and [Distributed Task Execution](https://nx.app/docs/distributed-execution) in the Nx Cloud docs.
