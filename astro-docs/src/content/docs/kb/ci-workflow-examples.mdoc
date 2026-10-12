---
title: CI Workflow Examples by Provider
description: Nx Cloud CI workflows for CircleCI, GitLab, Azure Pipelines, Jenkins, and Bitbucket Pipelines, with remote caching, affected, and Nx Agents.
filter: 'type:Guides'
topics:
  - 'Continuous integration'
  - 'Nx Cloud'
---

Each workflow below runs `nx affected` with remote caching and distributes tasks on [Nx Agents](/docs/features/ci-features/distribute-task-execution).
For GitHub Actions and a step-by-step walkthrough, see [setting up CI](/docs/getting-started/setup-ci).

{% course_video src="https://www.youtube.com/watch?v=8mqHXYIl_qI" courseTitle="From PNPM Workspaces to Distributed CI" courseUrl="https://nx.dev/courses/pnpm-nx-next/lessons-06-nx-cloud-setup" /%}

Every example uses the same `.nx/ci-config.yaml`:

```yaml
// .nx/ci-config.yaml
dte:
  distribute-on: 3 linux-large-js
lifecycle:
  stop-after:
    - build
```

Each workflow starts the agents with `nx-cloud start-nx-agents` before installing dependencies, so agents boot while the main job installs.
To see how each provider works out the commit range for `nx affected`, see [set the affected base commit in CI](/docs/kb/affected-base-commit).

{% tabs syncKey="ci-provider" %}
{% tabitem label="CircleCI" %}

Generate a starting workflow with `nx g ci-workflow --ci=circleci`, or start from this one:

```yaml
// .circleci/config.yml
version: 2.1

orbs:
  nx: nrwl/nx@1.7.0

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout

      - run: npx nx-cloud start-nx-agents

      - run: npm ci
      - nx/set-shas:
          main-branch-name: 'main'

      - run:
          command: npx nx affected -t lint test build

workflows:
  version: 2

  ci:
    jobs:
      - main
```

{% /tabitem %}
{% tabitem label="GitLab" %}

Generate a starting workflow with `nx g ci-workflow --ci=gitlab`, or start from this one:

```yaml
// .gitlab-ci.yml
image: node:22
variables:
  CI: 'true'

CI:
  interruptible: true
  only:
    - main
    - merge_requests
  script:
    - npx nx-cloud start-nx-agents

    - npm ci
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

    - npx nx affected -t lint test build
```

{% /tabitem %}
{% tabitem label="Azure" %}

Generate a starting workflow with `nx g ci-workflow --ci=azure`, or start from this one:

```yaml
// azure-pipelines.yml
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
        fetchDepth: '0'
        fetchFilter: tree:0
      - bash: az devops configure --defaults organization=$(System.TeamFoundationCollectionUri) project=$(System.TeamProject)
        displayName: 'Set default Azure DevOps organization and project'
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

      - script: npx nx-cloud start-nx-agents

      - script: npm ci
      - script: git branch --track main origin/main
        condition: eq(variables['Build.Reason'], 'PullRequest')

      - script: npx nx affected --base=$(BASE_SHA) --head=$(HEAD_SHA) -t lint test build
```

{% /tabitem %}
{% tabitem label="Jenkins" %}

The CI workflow generator doesn't support Jenkins, so start from this pipeline:

```groovy
pipeline {
    agent none
    environment {
        NX_BRANCH = env.BRANCH_NAME.replace('PR-', '')
    }
    stages {
        stage('Pipeline') {
            parallel {
                stage('Main') {
                    when {
                        branch 'main'
                    }
                    agent any
                    steps {
                        sh "npx nx-cloud start-nx-agents"
                        sh "npm ci"
                        sh "npx nx affected --base=HEAD~1 -t lint test build"
                    }
                }
                stage('PR') {
                    when {
                        not { branch 'main' }
                    }
                    agent any
                    steps {
                        sh "npx nx-cloud start-nx-agents"
                        sh "npm ci"
                        sh "npx nx affected --base origin/${env.CHANGE_TARGET} -t lint test build"
                    }
                }
            }
        }
    }
}
```

{% /tabitem %}
{% tabitem label="Bitbucket" %}

Generate a starting workflow with `nx g ci-workflow --ci=bitbucket-pipelines`, or start from this one:

```yaml
// bitbucket-pipelines.yml
image: node:22

clone:
  depth: full

pipelines:
  pull-requests:
    '**':
      - step:
          name: 'Build and test affected apps on pull requests'
          script:
            - export NX_BRANCH=$BITBUCKET_PR_ID
            - npx nx-cloud start-nx-agents
            - npm ci
            - npx nx affected --base=origin/main -t lint test build

  branches:
    main:
      - step:
          name: 'Build and test affected apps on main'
          script:
            - export NX_BRANCH=$BITBUCKET_BRANCH
            - npx nx-cloud start-nx-agents
            - npm ci
            - npx nx affected -t lint test build --base=HEAD~1
```

{% /tabitem %}
{% /tabs %}

For every `.nx/ci-config.yaml` option, see the [CI configuration file reference](/docs/reference/nx-cloud/ci-config).
