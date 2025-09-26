# Manual Distributed Task Execution on Circle CI

Using [Nx Agents](/ci/features/distribute-task-execution) is the easiest way to distribute task execution, but it your organization may not be able to use hosted Nx Agents. You can set up distributed task execution on your own CI provider using the recipe below.

## Run Agents on Circle CI

Run agents directly on Circle CI with the workflow below:

```yaml {% fileName=".circleci/config.yml" %}
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npm ci
      - nx/set-shas

      # Tell Nx Cloud to use DTE and stop agents when the e2e-ci tasks are done
      - run: npx nx-cloud start-ci-run --distribute-on="manual" --stop-agents-after=e2e-ci
      # Send logs to Nx Cloud for any CLI command
      - run: npx nx-cloud record -- nx format:check
      # Lint, test, build and run e2e on agent jobs for everything affected by a change
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build,e2e-ci --parallel=2 --configuration=ci
  agent:
    docker:
      - image: cimg/node:lts-browsers
    parameters:
      ordinal:
        type: integer
    steps:
      - checkout
      - run: npm ci
      # Wait for instructions from Nx Cloud
      - run:
          command: npx nx-cloud start-agent
          no_output_timeout: 60m
workflows:
  build:
    jobs:
      - agent:
          matrix:
            parameters:
              ordinal: [1, 2, 3]
      - main
```

This configuration is setting up two types of jobs - a main job and three agent jobs.

The main job tells Nx Cloud to use DTE and then runs normal Nx commands as if this were a single pipeline set up. Once the commands are done, it notifies Nx Cloud to stop the agent jobs.

The agent jobs set up the repo and then wait for Nx Cloud to assign them tasks.

{% callout type="warning" title="Two Types of Parallelization" %}
The `ordinal: [1, 2, 3]` line and the `--parallel` flag both parallelize tasks, but in different ways. The way this workflow is written, there will be 3 agents running tasks and each agent will try to run 2 tasks at once. If a particular CI run only has 2 tasks, only one agent will be used.
{% /callout %}

## Rerunning jobs with DTE

Rerunning only failed jobs results in agent jobs not running, which causes the CI pipeline to hang and eventually timeout. This is a common pitfall when using a CI providers "rerun failed jobs", or equivalent, feature since agent jobs will always complete successfully.

To enforce rerunning all jobs, you can set up your CI pipeline to exit early with a helpful error.
For example:

> You reran only failed jobs, but CI requires rerunning all jobs.
> Rerun all jobs in the pipeline to prevent this error.

At a high level:

1. Create a job that always succeeds and uploads an artifact on the pipeline with the run attempt number of the pipeline.
2. The main and agent jobs can read the artifact file when starting and assert they are on the same re-try attempt.
3. If the reattempt number does not match, then error with a message stating to rerun all jobs. Otherwise, the pipelines are on the same rerun and can proceed as normally.
