---
title: 'Circle CI Tutorial with Nx'
description: In this tutorial you'll set up continuous integration with Circle CI and Nx
---

# Circle CI with Nx

Continuous integration (CI) is critical to a well-functioning software development process. Without CI, you are either shipping bugs directly to production, or you have to spend a long time testing and retesting your software every time you make a release. You suffer either in reliability or throughput - and usually both.

With a quality CI pipeline in place, every merged pull request is checked with a baseline set of tests so that you have the confidence to deploy more frequently without increasing the failure rate of your deployments. When setting up the CI pipeline, you also have to be careful to keep the pipeline performant so that you aren't unnecessarily extending the lead time for changes.

This tutorial will show you how to solve these problems with Nx and Nx Cloud, using Circle CI as the CI provider.

## Starting Repository

To follow along with this tutorial, we recommend using either a repo you created following one of the [Learn Nx tutorials](https://nx.dev/getting-started/intro#learn-nx) or the [nx-shops sample repository](https://github.com/isaacplmann/nx-shops).

The repository you choose should have the following characteristics:

- Multiple Nx projects with interdependencies
- Defined lint, test, build and e2e tasks
- Some of the tasks should take more than a few seconds to complete

To get started, clone your repo and make sure that your tasks are working on your machine.

```shell
nx run-many -t lint,test,build,e2e
```

## Set-up Circle CI

In order to use Circle CI, you need to [sign up and create an organization](https://circleci.com/docs/first-steps/#sign-up-and-create-an-org). Follow the steps in the Circle CI documentation to connect to your GitHub repository. When you are asked to configure a pipeline, choose any option, since we'll overwrite it in the next step.

To verify that Circle CI is set up correctly we'll create a pipeline that just logs a message. First, checkout a new branch:

```shell
git checkout -b circle-message
```

Then create (or modify) the `.circleci/config.yml` file with these contents:

```yaml {% fileName=".circleci/config.yml" %}
version: 2.1

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - run:
          name: Print a message
          command: echo "Hello Circle CI!"

workflows:
  version: 2

  ci:
    jobs:
      - main:
          name: Nx Cloud Main
```

Next, commit this change, push the branch and create a PR:

```shell
git commit -am "pipeline that logs a message"
git push -u origin HEAD
```

If everything was set up correctly, you should see a message from Circle CI in the PR with a success status.

![All checks have passed in the PR](/nx-cloud/tutorial/Circle%20PR%20passed.png)

Click on the job details and you should see the `Hello Circle CI` message in the logs.

![The "Hello Circle CI" message is printed in the logs](/nx-cloud/tutorial/Message%20Logged.png)

## Use Nx in CI

Now let's use Nx in the pipeline. The simplest way to use Nx is to run a single task, so we'll start with `nx build cart`.

In order to use Nx in CI, we need to checkout the repo and install NPM dependencies. While we're focused on NPM dependencies let's also have [Circle CI cache those dependencies](https://circleci.com/docs/caching/).

Create a new branch called `build-one-app` and paste this code into the Circle CI config.

```yaml {% fileName=".circleci/config.yml" %}
version: 2.1

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      # look for existing cache and restore if found
      - restore_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
      # install dependencies
      - run:
          name: install dependencies
          command: pnpm install --frozen-lockfile
      # save any changes to the cache
      - save_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules
            - ~/.cache/Cypress # needed for the Cypress binary
      - run:
          name: Run build
          command: npx nx build cart

workflows:
  version: 2

  ci:
    jobs:
      - main:
          name: Nx Cloud Main
```

The `restore_cache` and `save_cache` steps are using a hash key that is created from the contents of the `pnpm-lock.yaml` file. This way if the `pnpm-lock.yaml` file remains the same, the next CI pipeline can pull from the cache instead of downloading `node_modules` again. This is similar to the way [Nx hashes input files to cache the results of tasks](/core-features/cache-task-results).

Once `node_modules` are in place, you can run normal Nx commands. In this case, we run `npx nx build cart`.

## Test Only Affected Projects

We could guarantee that everything still works by running every task after every PR.

```{% command="nx run-many -t build" %}
    ✔  nx run shared-product-types:build (429ms)
    ✔  nx run shared-product-ui:build (455ms)
    ✔  nx run shared-header:build (467ms)
    ✔  nx run landing-page:build:production (3s)
    ✔  nx run admin:build:production (3s)
    ✔  nx run products:build (6s)
    ✔  nx run cart:build:production (3s)

 ————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 7 projects (16s)
```

For a small repository, this might be good enough, but after a little bit of growth this approach will cause your CI times to become unmanageable. Let's use the [affected command](/nx-cloud/features/affected) to only run tasks for projects that were affected by a PR.

```{% command="nx affected -t build" %}
    ✔  nx run shared-product-types:build (404ms)
    ✔  nx run shared-product-ui:build (445ms)
    ✔  nx run shared-header:build (465ms)
    ✔  nx run cart:build:production (3s)

 ——————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project cart and 3 tasks it depends on (4s)
```

That affected command uses a `base` and `head` commit from your git history to determine which files have been changed and then uses the project graph to determine which projects could have been affected by those changes. The default `base` is your `main` branch and the default `head` is your current file system. This is generally what you want when developing locally, but in CI, you need to customize these values.

The goal of the CI pipeline is to make sure that the current state of the repository is a good one. To ensure this, we want to verify all the changes since the last successful CI run - not just since the last commit on `main`. The [`nrwl/nx` Circle CI orb](https://github.com/nrwl/nx-orb#background) provides you with the `nx/set-shas` step which automatically sets the `$NX_BASE` and `$NX_HEAD` environment variables to the correct commit SHAs for you to use in the affected command.

{% callout type="note" title="Enable Third-Party Orbs" %}
In order to use the `nrwl/nx` orb, you need to enable the use of third-party Circle CI orbs in your organization settings. In the Circle CI project dashboard, go to Organization Settings -> Security and select `Yes` under Orb Security Settings: Allow Uncertified Orbs.
{% /callout %}

Let's set up the CI pipeline to use the affected command. Create a new branch called `ci-affected` and create a PR with the following configuration:

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
      - restore_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
      - run:
          name: install dependencies
          command: pnpm install --frozen-lockfile
      - save_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules
            - ~/.cache/Cypress
      - nx/set-shas

      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1
workflows:
  build:
    jobs:
      - main
```

The key lines are here:

```yaml
- run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
- run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1
```

Notice how we're using the `$NX_BASE` and `$NX_HEAD` environment variables to set the correct `base` and `head` commits to use for file comparisons.

We're also using the `--parallel` flag to run up to 3 `lint`, `test` or `build` tasks at once, but we want to make sure that only 1 `e2e` task is running at a time.

When you check the CI logs for this PR, you'll notice that no tasks were run by the `affected` command. That's because the `.circleci/config.yml` file is not an input for any task. We should really double check every task whenever we make changes to the CI pipeline, so let's fix that by adding an entry in the `sharedGlobals` array in the `nx.json` file.

```jsonc {% fileName="nx.json" %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [
      "{workspaceRoot}/babel.config.json",
      "{workspaceRoot}/.circleci/config.yml" // add this line
    ]
    // etc...
  }
}
```

## Caching in CI

If you run a task multiple times locally, Nx will [replay from the cache](/core-features/cache-task-results) the second time around. That cache isn't being used in CI though, because it is stored on your local file system. Run `nx connect` to enable [remote caching](/nx-cloud/features/remote-cache) with Nx Cloud so that local dev machines and the CI pipeline can share the same cache.

```{% command="nx connect" %}
✔ Enable distributed caching to make your CI faster · Yes
$ nx g nx:connect-to-nx-cloud --quiet --no-interactive

 >  NX   Distributed caching via Nx Cloud has been enabled

   In addition to the caching, Nx Cloud provides config-free distributed execution,
   UI for viewing complex runs and GitHub integration. Learn more at https://nx.app

   Your workspace is currently unclaimed. Run details from unclaimed workspaces can be viewed on cloud.nx.app by anyone
   with the link. Claim your workspace at the following link to restrict access.

   https://cloud.nx.app/orgs/workspace-setup?accessToken=[YourAccessTokenHere]

✨  Done in 0.78s.
```

Click the link in the terminal to claim your workspace on [nx.app](https://nx.app).

Once your workspace is connected to Nx Cloud, run some tasks locally to prime the cache:

```shell
nx run-many -t lint,test,build,e2e
```

Now let's commit the changes to a new `ci-caching` branch and create a PR. The only change to the source code is adding an `nxCloudAccessToken` property to `nx.json`.

You should see the `nx affected` step is executed very quickly because the CI pipeline uses the task results from your local execution of the commands. If you don't like the idea of your CI pipeline reusing artifacts created on local developer machines, you can choose from other [security scenarios](/nx-cloud/account/scenarios) by using different configurations of access tokens.

## Distributed Task Execution

The affected command and remote caching help speed up the average CI time, but there will be some PRs that affect everything in the repository. The only way to speed up that worst case scenario is through efficient parallelization. The best way to parallelize CI with Nx is to use [distributed task execution (DTE)](/nx-cloud/features/distribute-task-execution).

Running tasks on different agent jobs allows us to perform the same work faster. Nx Cloud's DTE feature optimally distributes tasks across the available agents and ensures that input files are always present on the agent jobs where they are required. After the whole pipeline is finished, the main job contains all the artifacts and logs as if every task were executed on that machine.

All of this is made possible with only a few extra lines in your CI configuration file.

```yaml {% fileName=".circleci/config.yml" %}
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  agent:
    docker:
      - image: cimg/node:lts-browsers
    parameters:
      ordinal:
        type: integer
    steps:
      - checkout
      - restore_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
      - run:
          name: install dependencies
          command: pnpm install --frozen-lockfile
      - save_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules
            - ~/.cache/Cypress
      - run:
          command: npx nx-cloud start-agent
          no_output_timeout: 60m
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - restore_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
      - run:
          name: install dependencies
          command: pnpm install --frozen-lockfile
      - save_cache:
          key: npm-dependencies-{{ checksum "pnpm-lock.yaml" }}
          paths:
            - node_modules
            - ~/.cache/Cypress
      - nx/set-shas

      - run: npx nx-cloud start-ci-run --stop-agents-after="e2e"

      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1

      - run: npx nx-cloud stop-all-agents
workflows:
  build:
    jobs:
      - agent:
          matrix:
            parameters:
              ordinal: [1, 2, 3]
      - main
```

We've added a new `agent` job that does the same checkout and install dependencies process and then runs this command:

```yaml
- run:
    command: npx nx-cloud start-agent
    no_output_timeout: 60m
```

The `nx-cloud start-agent` command notifies Nx Cloud that this machine is waiting to run tasks that are assigned to it. `no_output_timeout: 60m` means that this agent will automatically shut down if it doesn't receive any instructions for 60 minutes.

The `main` job looks very similar to the previous configuration, with the addition of a single line above and below the `nx affected` commands.

```yaml
- run: npx nx-cloud start-ci-run --stop-agents-after="e2e"

- run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
- run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1

- run: npx nx-cloud stop-all-agents
```

- `nx-cloud start-ci-run` lets Nx know that all the tasks after this line should be orchestrated with Nx Cloud's DTE process
- `--stop-agents-after="e2e"` lets Nx Cloud know which line is the last command in this pipeline. Once there are no more e2e tasks for an agent to run, Nx Cloud will automatically shut them down. This way you're not wasting money on idle agents while a particularly long e2e task is running on a single agent.
- `nx-cloud stop-all-agents` notifies every agent that all the tasks are completed and they can shut down.

With this pipeline configuration in place, no matter how large the repository scales, Nx Cloud will adjust and distribute tasks across agents in the optimal way. If CI pipelines start to slow down, just add some agents to the `ordinal: [1, 2, 3]` array.

## Next Steps

You now have a highly optimized CI configuration that will scale as your repository scales. See what else you can do with Nx Cloud.

- Set up [GitHub PR integration](/nx-cloud/recipes/source-control-integration/github) to view Nx Cloud results directly in your PR
- Choose the [security scenario](/nx-cloud/account/scenarios) that makes sense for your organization
- [Record non-Nx commands](/nx-cloud/recipes/other/record-commands) and view the results in the Nx Cloud interface
