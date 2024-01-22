# Configuring CI Using Azure Pipelines and Nx

There are two general approaches to setting up CI with Nx - using a single job or distributing tasks across multiple jobs. For smaller repositories, a single job is faster and cheaper, but once a full CI run starts taking 10 to 15 minutes, using multiple jobs becomes the better option. Nx Cloud's distributed task execution allows you to keep the CI pipeline fast as you scale. As the repository grows, all you need to do is add more agents.

## Process Only Affected Projects With One Job on Azure Pipelines

Below is an example of an Azure Pipelines setup that runs on a single job, building and testing only what is affected. This uses the [`nx affected` command](/ci/features/affected) to run the tasks only for the projects that were affected by that PR.

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
      # Set Azure Devops CLI default settings
      - bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
        displayName: 'Set default Azure DevOps organization and project'

      # Get last successfull commit from Azure Devops CLI
      - displayName: 'Get last successful commit SHA'
        condition: ne(variables['Build.Reason'], 'PullRequest')
        env:
          AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)
        bash: |
          LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
          if [ -z "$LAST_SHA" ]
          then
            echo "Last successful commit not found. Using fallback 'HEAD~1': $BASE_SHA"
          else
            echo "Last successful commit SHA: $LAST_SHA"
            echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
          fi

      # Required for nx affected if we're on a branch
      - script: git branch --track main origin/main
      - script: npm ci
      - script: npx nx-cloud record -- nx format:check --base=$(BASE_SHA)
      - script: npx nx affected --base=$(BASE_SHA) -t lint,test,build --parallel=3 --configuration=ci
```

{% callout type="note" title="Check your Shallow Fetch settings" %}

Nx needs additional Git history available for [`affected`](/ci/features/affected) to function correctly. Make sure Shallow fetching is disabled in your pipeline settings UI. For more info, check out this article from Microsoft [here](https://learn.microsoft.com/en-us/azure/devops/pipelines/yaml-schema/steps-checkout?view=azure-pipelines#shallow-fetch).

{% /callout %}

Unlike `GitHub Actions` and `CircleCI`, you don't have the metadata to help you track the last successful run on `main`. In the example below, the base is set to `HEAD~1` (for push) or branching point (for pull requests), but a more robust solution would be to tag a SHA in the main job once it succeeds and then use this tag as a base. You can also try [using the devops CLI within the pipeline yaml](#get-the-commit-of-the-last-successful-build). See the [nx-tag-successful-ci-run](https://github.com/nrwl/nx-tag-successful-ci-run) and [nx-set-shas](https://github.com/nrwl/nx-set-shas) (version 1 implements tagging mechanism) repositories for more information.

We also have to set `NX_BRANCH` explicitly. NX_BRANCH does not impact the functionality of your runs, but does provide a human-readable label to easily identify them in the Nx Cloud app.

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

## Distribute Tasks Across Agents on Azure Pipelines

To set up [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), you can run this generator:

```shell
npx nx g ci-workflow --ci=azure
```

Or you can copy and paste the workflow below:

```yaml {% fileName="azure-pipelines.yml" %}
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
      # Get last successfull commit from Azure Devops CLI
      - displayName: 'Get last successful commit SHA'
        condition: ne(variables['Build.Reason'], 'PullRequest')
        env:
          AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)
        bash: |
          LAST_SHA=$(az pipelines build list --branch $(Build.SourceBranchName) --definition-ids $(System.DefinitionId) --result succeeded --top 1 --query "[0].triggerInfo.\"ci.sourceSha\"")
          if [ -z "$LAST_SHA" ]
          then
            echo "Last successful commit not found. Using fallback 'HEAD~1': $BASE_SHA"
          else
            echo "Last successful commit SHA: $LAST_SHA"
            echo "##vso[task.setvariable variable=BASE_SHA]$LAST_SHA"
          fi

      - script: git branch --track main origin/main
      - script: npm ci
      - script: npx nx-cloud start-ci-run --stop-agents-after="build"
      - script: npx nx-cloud record -- nx format:check --base=$(BASE_SHA) --head=$(HEAD_SHA)
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) -t lint,test,build --parallel=2 --configuration=ci
```

This configuration is setting up two types of jobs - a main job and three agent jobs.

The main job tells Nx Cloud to use DTE and then runs normal Nx commands as if this were a single pipeline set up. Once the commands are done, it notifies Nx Cloud to stop the agent jobs.

The agent jobs set up the repo and then wait for Nx Cloud to assign them tasks.

{% callout type="warning" title="Two Types of Parallelization" %}
The agent strategy of `parallel: 3` and the `nx affected --parallel=2` flag both parallelize tasks, but in different ways. The way this workflow is written, there will be 3 agents running tasks and each agent will try to run 2 tasks at once. If a particular CI run only has 2 tasks, only one agent will be used.
{% /callout %}
