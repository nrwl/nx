---
title: Configuring CI Using Azure Pipelines and Nx
description: Learn how to set up Azure Pipelines for your Nx workspace to run affected commands, retrieve previous successful builds, and optimize CI performance.
---

# Configuring CI Using Azure Pipelines and Nx

Below is an example of an Azure Pipelines setup building and testing only what is affected.

> Need a starting point? Generate a new workflow file with `nx g ci-workflow --ci=azure`

```yaml {% fileName="azure-pipelines.yml" %}
name: CI

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
      - checkout: self
        fetchDepth: 0
        fetchFilter: tree:0
      # Set Azure Devops CLI default settings
      - bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
        displayName: 'Set default Azure DevOps organization and project'
      # Get last successfull commit from Azure Devops CLI
      - bash: |
          LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
          if [ -z "$LAST_SHA" ]
          then
            echo "Last successful commit not found. Using fallback 'HEAD~1': $BASE_SHA"
          else
            echo "Last successful commit SHA: $LAST_SHA"
            echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
          fi
        displayName: 'Get last successful commit SHA'
        condition: ne(variables['Build.Reason'], 'PullRequest')
        env:
          AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this line to enable task distribution
      # - script: npx nx start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"

      - script: npm ci --legacy-peer-deps
      - script: git branch --track main origin/main
        condition: eq(variables['Build.Reason'], 'PullRequest')

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - script: npx nx-cloud record -- echo Hello World
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) -t lint test build
      # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
      - script: npx nx fix-ci
        condition: always()
```

## Get the Commit of the Last Successful Build

In the example above, we ran a script to retrieve the commit of the last successful build. The idea is to
use [Azure Devops CLI](https://learn.microsoft.com/en-us/cli/azure/pipelines?view=azure-cli-latest) directly in the [Pipeline Yaml](https://learn.microsoft.com/en-us/azure/devops/cli/azure-devops-cli-in-yaml?view=azure-devops)

First, we configure Devops CLI

```yaml
# Set Azure Devops CLI default settings
- bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
  displayName: 'Set default Azure DevOps organization and project'
```

Then we can query the pipelines API (providing the auth token)

```yaml
# Get last successfull commit from Azure Devops CLI
- bash: |
    LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
    if [ -z "$LAST_SHA" ]
    then
      echo "Last successful commit not found. Using fallback 'HEAD~1': $BASE_SHA"
    else
      echo "Last successful commit SHA: $LAST_SHA"
      echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
    fi
  displayName: 'Get last successful commit SHA'
  condition: ne(variables['Build.Reason'], 'PullRequest')
  env:
    AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)
```

We can target a specific build; in this example, we specified:

- The branch (--branch)
- The result type (--result)
- The number of the result (--top)

The command returns an entire JSON object with all the information. But we can narrow it down to the desired result with the `--query` param that uses [JMESPath](https://jmespath.org/)
format ([more details](https://learn.microsoft.com/en-us/cli/azure/query-azure-cli?tabs=concepts%2Cbash))

Finally, we extract the result in a common [custom variable](https://learn.microsoft.com/en-us/azure/devops/pipelines/process/set-variables-scripts?view=azure-devops&tabs=bash)
named `BASE_SHA` used later by the `nx format` and `nx affected` commands.
