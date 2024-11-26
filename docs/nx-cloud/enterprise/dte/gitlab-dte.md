# Custom Distributed Task Execution on GitLab

Using [Nx Agents](/ci/features/distribute-task-execution) is the easiest way to distribute task execution, but it your organization may not be able to use hosted Nx Agents. With an [enterprise license](/enterprise), you can set up distributed task execution on your own CI provider using the recipe below.

## Run Custom Agents on GitLab

Run agents directly on GitLab with the workflow below:

```yaml {% fileName=".gitlab-ci.yml" %}
image: node:18

# Creating template for DTE agents
.dte-agent:
  interruptible: true
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - '.yarn-cache/'
  script:
    - yarn install --cache-folder .yarn-cache --prefer-offline --frozen-lockfile
    - yarn nx-cloud start-agent

# Creating template for a job running DTE (orchestrator)
.base-pipeline:
  interruptible: true
  only:
    - main
    - merge_requests
  cache:
    key:
      files:
        - yarn.lock
    paths:
      - '.yarn-cache/'
  before_script:
    - yarn install --cache-folder .yarn-cache --prefer-offline --frozen-lockfile
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}
    - NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT=3 # expected number of agents

  artifacts:
    expire_in: 5 days
    paths:
      - dist

# Main job running DTE
nx-dte:
  stage: affected
  extends: .base-pipeline
  script:
    - yarn nx-cloud start-ci-run --distribute-on="manual" --stop-agents-after=e2e-ci
    - yarn nx-cloud record -- nx format:check --base=$NX_BASE --head=$NX_HEAD
    - yarn nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build,e2e-ci --parallel=2

# Create as many agents as you want
nx-dte-agent1:
  extends: .dte-agent
  stage: affected
nx-dte-agent2:
  extends: .dte-agent
  stage: affected
nx-dte-agent3:
  extends: .dte-agent
  stage: affected
```

This configuration is setting up two types of jobs - a main job and three agent jobs.

The main job tells Nx Cloud to use DTE and then runs normal Nx commands as if this were a single pipeline set up. Once the commands are done, it notifies Nx Cloud to stop the agent jobs.

The agent jobs set up the repo and then wait for Nx Cloud to assign them tasks.

{% callout type="warning" title="Two Types of Parallelization" %}
The agents and the `--parallel` flag both parallelize tasks, but in different ways. The way this workflow is written, there will be 3 agents running tasks and each agent will try to run 2 tasks at once. If a particular CI run only has 2 tasks, only one agent will be used.
{% /callout %}
