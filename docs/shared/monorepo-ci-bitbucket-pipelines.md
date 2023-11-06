# Configuring CI Using Bitbucket Pipelines and Nx

Below is an example of a Bitbucket Pipeline setup for an Nx workspace - building and testing only what is affected.

```yaml
image: node:20
pipelines:
  pull-requests:
    '**':
      - step:
          name: 'Build and test affected apps on Pull Requests'
          caches: # optional
            - node
          script:
            - npm ci
            - npx nx format:check
            - npx nx affected -t lint,test,build --base=origin/master --head=HEAD --configuration=ci

  branches:
    main:
      - step:
          name: "Build and test affected apps on 'main' branch changes"
          caches: # optional
            - node
          script:
            - npm ci
            - npx nx format:check
            - npx nx affected -t lint,test,build --base=HEAD~1 --configuration=ci
```

The `pull-requests` and `main` jobs implement the CI workflow.

## Distributed Task Execution

This pipeline uses [Distributed Task Execution (DTE)](/core-features/distribute-task-execution) to automatically distribute work across multiple agent processes.

```yaml
image: node:20

clone:
  depth: full

definitions:
  steps:
    - step: &agent
        name: Agent
        script:
          - export NX_BRANCH=$BITBUCKET_PR_ID

          - npm ci
          - npx nx-cloud start-agent

pipelines:
  pull-requests:
    '**':
      - parallel:
          - step:
              name: CI
              script:
                - export NX_BRANCH=$BITBUCKET_PR_ID

                - npm ci
                - npx nx-cloud start-ci-run --stop-agents-after="build" --agent-count=3
                - npx nx-cloud record -- npx nx format:check
                - npx nx affected --target=lint,test,build
                - npx nx-cloud stop-all-agents
          - step: *agent
          - step: *agent
          - step: *agent
```
