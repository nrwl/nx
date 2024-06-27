# Configuring CI Using Azure Pipelines and Nx

Below is an example of an Azure Pipelines setup building and testing only what is affected.

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

      # Connect your workspace on nx.app and uncomment this to enable task distribution.
      # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "e2e-ci" targets have been requested
      # - script: yarn nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="e2e-ci"

      - script: yarn install --frozen-lockfile
      - script: git branch --track main origin/main
        condition: eq(variables['Build.Reason'], 'PullRequest')

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - script: yarn nx-cloud record -- echo Hello World
      - script: yarn nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) lint test build
      - script: yarn nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) --parallel 1 e2e-ci
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
