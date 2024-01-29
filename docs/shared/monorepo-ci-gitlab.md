# Configuring CI Using GitLab and Nx

There are two general approaches to setting up CI with Nx - using a single job or distributing tasks across multiple jobs. For smaller repositories, a single job is faster and cheaper, but once a full CI run starts taking 10 to 15 minutes, using multiple jobs becomes the better option. Nx Cloud's distributed task execution allows you to keep the CI pipeline fast as you scale. As the repository grows, all you need to do is add more agents.

## Process Only Affected Projects With One Job on GitLab

Below is an example of an GitLab setup that runs on a single job, building and testing only what is affected. This uses the [`nx affected` command](/ci/features/affected) to run the tasks only for the projects that were affected by that PR.

```yaml {% fileName=".gitlab-ci.yml" %}
image: node:18

stages:
  - lint
  - test
  - build

.distributed:
  interruptible: true
  only:
    - main
    - merge_requests
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - .npm/
  before_script:
    - npm ci --cache .npm --prefer-offline
    - NX_HEAD=$CI_COMMIT_SHA
    - NX_BASE=${CI_MERGE_REQUEST_DIFF_BASE_SHA:-$CI_COMMIT_BEFORE_SHA}

variables:
  GIT_DEPTH: 0

format-check:
  stage: test
  extends: .distributed
  script:
    - npx nx-cloud record -- nx format:check --base=$NX_BASE --head=$NX_HEAD

lint:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint --parallel=3

test:
  stage: test
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t test --parallel=3 --configuration=ci

build:
  stage: build
  extends: .distributed
  script:
    - npx nx affected --base=$NX_BASE --head=$NX_HEAD -t build --parallel=3
```

The `build` and `test` jobs implement the CI workflow using `.distributed` as a template to keep the CI configuration file more readable.

## Distribute Tasks Across Agents on GitLab

To set up [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), you can run this generator:

```shell
npx nx g ci-workflow --ci=gitlab
```

Or you can copy and paste the workflow below:

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
  artifacts:
    expire_in: 5 days
    paths:
      - dist

# Main job running DTE
nx-dte:
  stage: affected
  extends: .base-pipeline
  script:
    - yarn nx-cloud start-ci-run --stop-agents-after=build
    - yarn nx-cloud record -- nx format:check --base=$NX_BASE --head=$NX_HEAD
    - yarn nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=2

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
