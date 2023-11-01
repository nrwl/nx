# Configuring CI Using Azure Pipelines and Nx

Below is an example of an Azure Pipelines setup for an Nx workspace - building and testing only what is affected.

{% callout type="note" title="Check your Shallow Fetch settings" %}

Nx needs additional Git history available for `affected` to function correctly. Make sure Shallow fetching is disabled in your pipeline settings UI. For more info, check out this article from Microsoft [here](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/steps-checkout?view=azure-pipelines#shallow-fetch).

{% /callout %}

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag an SHA in the main job once it succeeds and then use this tag as a base. You can also try [using the devops CLI within the pipeline yaml](#get-the-commit-of-the-last-successful-build). See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repositories for more information.

We also have to set `NX_BRANCH` explicitly. NX_BRANCH does not impact the functionality of your runs, but does provide a human-readable label to easily identify them in the Nx Cloud app.

```yaml {% fileName="azure-pipelines.yml" %}
trigger:
  - main
pr:
  - main

variables:
  CI: 'true'
  ${{ if eq(variables['Build.Reason'], 'PullRequest') }}:
    NX_BRANCH: $(System.PullRequest.PullRequestId) # You can use $(System.PullRequest.PullRequestNumber if your pipeline is triggered by a PR from GitHub ONLY)
    TARGET_BRANCH: $[replace(variables['System.PullRequest.TargetBranch'],'refs/heads/','origin/')]
  ${{ if ne(variables['Build.Reason'], 'PullRequest') }}:
    NX_BRANCH: $(Build.SourceBranchName)
  HEAD_SHA: $(git rev-parse HEAD)

jobs:
  - job: main
    pool:
      vmImage: 'ubuntu-latest'
    steps:
      # Set Azure Devops CLI default settings
      - bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
        displayName: 'Set default Azure DevOps organization and project'

      # Get last successfull commit from Azure Devops CLI
      - bash: |
          LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
          if [ -z "$LAST_SHA" ]
          then
            LAST_SHA=$DEFAULT_BASE_SHA
          fi
          echo "Last successful commit SHA: $LAST_SHA"
          echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
        displayName: 'Get last successful commit SHA'
        env:
          AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)

      # Required for nx affected if we're on a branch
      - script: git branch --track main origin/main
      - script: npm ci
      - script: npx nx format:check --base=$(BASE_SHA)
      - script: npx nx affected --base=$(BASE_SHA) -t lint,test,build --parallel=3 --configuration=ci
```

The `main` job implements the CI workflow.

## Get the Commit of the Last Successful Build

In the example above we ran a script to retrieve the commit of the last successful build. The idea is to use [Azure Devops CLI](https://learn.microsoft.com/en-us/cli/azure/pipelines?view=azure-cli-latest)
directly in the [Pipeline Yaml](https://learn.microsoft.com/en-us/azure/devops/cli/azure-devops-cli-in-yaml?view=azure-devops)

First, we configure Devops CLI

```yaml
# Set Azure Devops default settings
- bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
  displayName: 'Configure Azure DevOps organization and project'
```

Then we can query the pipelines API (providing the auth token)

```yaml
# Get last successfully commit infos from Azure Devops
- bash: |
    LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
    echo "Last successful commit SHA: $LAST_SHA"
    echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
  displayName: 'Get last successful commit SHA'
  env:
    AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)
```

We can target a specific build, in this example we specified:

- The branch (--branch)
- The pipeline Id (--definition-ids)
- The result type (--result)
- The number of result (-top)

By default the command returns an entire JSON object with all the information. But we can narrow it down to the desired result with the `--query` param that uses [JMESPath](https://jmespath.org/) format ([more details](https://learn.microsoft.com/en-us/cli/azure/query-azure-cli?tabs=concepts%2Cbash))

Finally we extract the result in a common [custom variable](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/set-variables-scripts?view=azure-devops&tabs=bash) named `BASE_SHA` used later by `nx affected` commands

## Distributed Task Execution with Nx Cloud

Read more about [Distributed Task Execution (DTE)](/core-features/distribute-task-execution).

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
      - script: git branch --track main origin/main
      - script: npm ci
      - script: npx nx-cloud start-ci-run --stop-agents-after="build"
      - script: npx nx-cloud record -- npx nx format:check --base=$(BASE_SHA) --head=$(HEAD_SHA)
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) -t lint,test,build --parallel=3 --configuration=ci
```

You can also use our [ci-workflow generator](/nx-api/workspace/generators/ci-workflow) to generate the pipeline file.
