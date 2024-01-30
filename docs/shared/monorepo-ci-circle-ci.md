# Configuring CI Using Circle CI and Nx

There are two general approaches to setting up CI with Nx - using a single job or distributing tasks across multiple jobs. For smaller repositories, a single job is faster and cheaper, but once a full CI run starts taking 10 to 15 minutes, using multiple jobs becomes the better option. Nx Cloud's distributed task execution allows you to keep the CI pipeline fast as you scale. As the repository grows, all you need to do is add more agents.

## Process Only Affected Projects With One Job on Circle CI

Below is an example of an Circle CI setup that runs on a single job, building and testing only what is affected. This uses the [`nx affected` command](/ci/features/affected) to run the tasks only for the projects that were affected by that PR.

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

      - run: npx nx-cloud record -- nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
workflows:
  build:
    jobs:
      - main
```

### Get the Commit of the Last Successful Build

`CircleCI` can track the last successful run on the `main` branch and use this as a reference point for the `BASE`. The `Nx Orb` provides a convenient implementation of this functionality which you can drop into your existing CI config. Specifically, `nx/set-shas` populates the `$NX_BASE` environment variable with the commit SHA of the last successful run.

To understand why knowing the last successful build is important for the affected command, check out the [in-depth explanation in Orb's docs](https://github.com/nrwl/nx-orb#background).

### Using CircleCI in a private repository

To use the [Nx Orb](https://github.com/nrwl/nx-orb) with a private repository on your main branch, you need to grant the orb access to your CircleCI API. You can do this by creating an environment variable called `CIRCLE_API_TOKEN` in the context or the project.

{% callout type="warning" title="Caution" %}
It should be a user token, not the project token.
{% /callout %}

## Distribute Tasks Across Agents on Circle CI

To set up [Distributed Task Execution (DTE)](/ci/features/distribute-task-execution), you can run this generator:

```shell
npx nx g ci-workflow --ci=circleci
```

Or you can copy and paste the workflow below:

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

      # Tell Nx Cloud to use DTE and stop agents when the build tasks are done
      - run: npx nx-cloud start-ci-run --stop-agents-after=build
      # Send logs to Nx Cloud for any CLI command
      - run: npx nx-cloud record -- nx format:check
      # Lint, test and build on agent jobs everything affected by a change
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=2 --configuration=ci
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
