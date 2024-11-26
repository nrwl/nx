# Custom Distributed Task Execution on Bitbucket Pipelines

Using [Nx Agents](/ci/features/distribute-task-execution) is the easiest way to distribute task execution, but it your organization may not be able to use hosted Nx Agents. With an [enterprise license](/enterprise), you can set up distributed task execution on your own CI provider using the recipe below.

## Run Custom Agents on Bitbucket Pipelines

Run agents directly on Bitbucket Pipelines with the workflow below:

```yaml {% fileName="bitbucket-pipelines.yml" %}
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
                - export NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT=3

                - npm ci
                - npx nx-cloud start-ci-run --distribute-on="manual" --stop-agents-after="e2e-ci" --agent-count=3
                - npx nx-cloud record -- nx format:check
                - npx nx affected --target=lint,test,build,e2e-ci --parallel=2
          - step: *agent
          - step: *agent
          - step: *agent
```

This configuration is setting up two types of jobs - a main job and three agent jobs.

The main job tells Nx Cloud to use DTE and then runs normal Nx commands as if this were a single pipeline set up. Once the commands are done, it notifies Nx Cloud to stop the agent jobs.

The agent jobs set up the repo and then wait for Nx Cloud to assign them tasks.

{% callout type="warning" title="Two Types of Parallelization" %}
The agents and the `--parallel` flag both parallelize tasks, but in different ways. The way this workflow is written, there will be 3 agents running tasks and each agent will try to run 2 tasks at once. If a particular CI run only has 2 tasks, only one agent will be used.
{% /callout %}
