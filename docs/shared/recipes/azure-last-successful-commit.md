# Get the Commit of the Last Successful Build in Azure Pipelines

The idea is to use [Azure Devops CLI](https://learn.microsoft.com/en-us/cli/azure/pipelines?view=azure-cli-latest)
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

An example with a default SHA in case no commit is found:

```yaml {% fileName="azure-pipelines.yml" %}
trigger:
  - main
pr:
  - main

variables:
  CI: 'true'
  NX_BRANCH: $(Build.SourceBranchName)
  DEFAULT_BASE_SHA: $(git rev-parse HEAD~1)
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

      - script: npm ci

      - script: npx nx workspace-lint
      - script: npx nx format:check

      - script: npx nx affected --base=$(BASE_SHA) -t lint --parallel=3
      - script: npx nx affected --base=$(BASE_SHA) -t test --parallel=3 --ci --code-coverage
      - script: npx nx affected --base=$(BASE_SHA) -t build --parallel=3
```
