# Custom Distributed Task Execution on Azure Pipelines

Using [Nx Agents](/ci/features/distribute-task-execution) is the easiest way to distribute task execution, but it your organization may not be able to use hosted Nx Agents. With an [enterprise license](/enterprise), you can set up distributed task execution on your own CI provider using the recipe below.

## Run Custom Agents on Azure Pipelines

Run agents directly on Azure Pipelines with the workflow below:

```yaml {% fileName="azure-pipelines.yml" %}
trigger:
  - main
pr:
  - main

variables:
  CI: 'true'
  NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT: 3 # expected number of agents
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
      - checkout: self
        fetchDepth: 0
        persistCredentials: true

      - script: npm ci
      - script: npx nx-cloud start-agent

  - job: main
    displayName: Nx Cloud Main
    pool:
      vmImage: 'ubuntu-latest'
    steps:
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

      - script: git branch --track main origin/main
      - script: npm ci
      - script: npx nx-cloud start-ci-run --distribute-on="manual" --stop-agents-after="e2e-ci"
      - script: npx nx-cloud record -- nx format:check --base=$(BASE_SHA) --head=$(HEAD_SHA)
      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) -t lint,test,build,e2e-ci --parallel=2 --configuration=ci
```

This configuration is setting up two types of jobs - a main job and three agent jobs.

The main job tells Nx Cloud to use DTE and then runs normal Nx commands as if this were a single pipeline set up. Once the commands are done, it notifies Nx Cloud to stop the agent jobs.

The agent jobs set up the repo and then wait for Nx Cloud to assign them tasks.

{% callout type="warning" title="Two Types of Parallelization" %}
The agent strategy of `parallel: 3` and the `nx affected --parallel=2` flag both parallelize tasks, but in different ways. The way this workflow is written, there will be 3 agents running tasks and each agent will try to run 2 tasks at once. If a particular CI run only has 2 tasks, only one agent will be used.
{% /callout %}
