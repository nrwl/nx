# Configuring CI Using Bitbucket Pipelines and Nx

There are two general approaches to setting up CI with Nx - using a single job or distributing tasks across multiple jobs. For smaller repositories, a single job is faster and cheaper, but once a full CI run starts taking 10 to 15 minutes, using multiple jobs becomes the better option. Nx Cloud's distributed task execution allows you to keep the CI pipeline fast as you scale. As the repository grows, all you need to do is add more agents.

## Process Only Affected Projects With One Job on Bitbucket Pipelines

Below is an example of an Bitbucket Pipelines setup that runs on a single job, building and testing only what is affected. This uses the [`nx affected` command](/ci/features/affected) to run the tasks only for the projects that were affected by that PR.

```yaml {% fileName="bitbucket-pipelines.yml" %}
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
            - npx nx-cloud record -- nx format:check
            - npx nx affected -t lint,test,build --base=origin/master --head=HEAD --configuration=ci

  branches:
    main:
      - step:
          name: "Build and test affected apps on 'main' branch changes"
          caches: # optional
            - node
          script:
            - npm ci
            - npx nx-cloud record -- nx format:check
            - npx nx affected -t lint,test,build --base=HEAD~1 --configuration=ci
```

The `pull-requests` and `main` jobs implement the CI workflow.

## Distribute Tasks Across Agents on Bitbucket Pipelines

To set up [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), you can run this generator:

```shell
npx nx g ci-workflow --ci=bitbucket-pipelines
```

Or you can copy and paste the workflow below:

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

                - npm ci
                - npx nx-cloud start-ci-run --stop-agents-after="build" --agent-count=3
                - npx nx-cloud record -- nx format:check
                - npx nx affected --target=lint,test,build --parallel=2
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
