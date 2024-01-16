---
title: 'Circle CI Tutorial with Nx'
description: In this tutorial you'll set up continuous integration with Circle CI and Nx
---

# Circle CI with Nx

In this tutorial we're going to learn how to leverage Nx to setup a scalable CI pipeline on Circle CI. You're going to learn

- how to set up Circle CI and configure Nx
- how to run tasks for only the projects that were affected by a given PR
- how to enable remote caching
- how to parallelize and distribute tasks across multiple machines

Note, many of these optimizations are incremental, meaning you could set up running tasks for only affected projects and stop there. Later when you experience slow CI runs, you could add caching to further improve CI performance or even go further and distribute tasks across machines.

## Example Repository

To follow along with this tutorial, we recommend using the [nx-shops sample repository](https://github.com/nrwl/nx-shops).

{% github-repository url="https://github.com/nrwl/nx-shops" /%}

The `nx-shops` repo is useful to demonstrate the value of the CI pipeline because it has the following characteristics:

- Multiple Nx projects with interdependencies
- Defined lint, test, build and e2e tasks
- Running all the tasks takes more than a minute to finish

To get started:

1. [Fork the nx-shop repo](https://github.com/nrwl/nx-shops/fork) and then clone it to your local machine

   ```shell
   git clone git@github.com:<your-username>/nx-shops.git
   ```

2. Install dependencies (this repo uses [PNPM](https://pnpm.io/) but you should be able to also use any other package manager)

   ```shell
   pnpm i
   ```

3. Explore the structure of the repo using **the Nx Graph**

   ```shell
   pnpm nx graph
   ```

4. Finally, make sure all task are working on your machine, by running lint, test, build and e2e on all projects of the workspace

   ```shell
   pnpm nx run-many -t lint,test,build,e2e
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
      - main
```

Next, commit this change, push the branch and create a PR on your forked GitHub repository:

```shell
git commit -am "pipeline that logs a message"
git push -u origin HEAD
```

If everything was set up correctly, you should see a message from Circle CI in the PR with a success status.

![All checks have passed in the PR](/nx-cloud/tutorial/Circle%20PR%20passed.png)

Click on the job details and you should see the `Hello Circle CI` message in the logs.

![The "Hello Circle CI" message is printed in the logs](/nx-cloud/tutorial/Message%20Logged.png)

Merge your PR into the `main` branch when you're ready to move to the next section.

## Configure Nx on Circle CI

Now let's use Nx in the pipeline. The simplest way to use Nx is to run a single task, so we'll start by building our `cart` application.

```shell
pnpm nx build cart
```

We need to adjust a couple of things on our CI pipeline to make this work:

- clone the repository
- install NPM dependencies (in our nx-shop using PNPM)
- use Nx to run the `build` command

Nx is an [npm package](https://www.npmjs.com/package/nx) so once NPM packages are installed we will be able to use it.

Create a new branch called `build-one-app` and paste this code into the Circle CI config.

```yaml {% fileName=".circleci/config.yml" highlightLines=["8-14"] %}
version: 2.1

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run:
          name: install dependencies
          command: pnpm install --frozen-lockfile
      - run:
          name: Run build
          command: pnpm nx build cart

workflows:
  version: 2

  ci:
    jobs:
      - main
```

Once `node_modules` are in place, you can run normal Nx commands. In this case, we run `pnpm nx build cart`. Push the changes to your repository by creating a new PR and verifying the new CI pipeline correctly builds our application.

![Building a single app with nx](/nx-cloud/tutorial/circle-single-build-success.jpg)

You might have noticed that there's also a build running for `shared-header`, `shared-product-types` and `shared-product-ui`. These are projects in our workspace that `cart` depends on. Thanks to the [Nx task pipeline](/concepts/task-pipeline-configuration), Nx knows that it needs to build these projects first before building `cart`. This already helps us simplify our pipeline as we

- don't need to define these builds automatically
- don't need to make any changes to our pipeline as our `cart` app grows and depends on more projects
- don't need to worry about the order of the builds

Merge your PR into the `main` branch when you're ready to move to the next section.

## Optimize our CI by caching NPM dependencies

While this isn't related to Nx specifically, it's a good idea to cache NPM dependencies in CI. This will speed up the CI pipeline by avoiding downloading the same dependencies over and over again. Circle CI has [a docs page on how to cache NPM dependencies](https://circleci.com/docs/caching/).

Adjust your CI pipeline script as follows

```yaml {% fileName=".circleci/config.yml" highlightLines=["10-11", "17-21"] %}
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
          command: pnpm nx build cart

workflows:
  version: 2

  ci:
    jobs:
      - main
```

The `restore_cache` and `save_cache` steps are using a hash key that is created from the contents of the `pnpm-lock.yaml` file. This way if the `pnpm-lock.yaml` file remains the same, the next CI pipeline can pull from the cache instead of downloading `node_modules` again. This is similar to the way [Nx hashes input files to cache the results of tasks](/features/cache-task-results).

Create a new branch with these changes and submit a PR to your repo to test them. Merge your PR into the `main` branch when you're ready to move to the next section.

## Process Only Affected Projects

So far we only ran the build for our `cart` application. There are other apps in our monorepo workspace though, namely `admin`, `landing-page` and `products`. We could now adjust our CI pipeline to add these builds as well:

```plaintext
pnpm nx build cart
pnpm nx build admin
pnpm nx build landing-page
```

Clearly this is not a scalable solution as it requires us to manually add every new app to the pipeline (and it doesn't include other tasks like `lint`, `test` etc). To improve this we can change the command to run the `build` for all projects like

```{% command="nx run-many -t build" %}
    ✔  nx run shared-product-types:build (429ms)
    ✔  nx run shared-product-ui:build (455ms)
    ✔  nx run shared-header:build (467ms)
    ✔  nx run landing-page:build:production (3s)
    ✔  nx run admin:build:production (3s)
    ✔  nx run cart:build:production (3s)

 ————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 6 projects (10s)
```

This change makes our CI pipeline configuration more maintainable. For a small repository, this might be good enough, but after a little bit of growth this approach will cause your CI times to become unmanageable.

Nx comes with a dedicated ["affected" command](/ci/features/affected) to help with that by only running tasks for projects that were affected by the changes in a given PR.

```{% command="nx affected -t build" %}
    ✔  nx run shared-product-types:build (404ms)
    ✔  nx run shared-product-ui:build (445ms)
    ✔  nx run shared-header:build (465ms)
    ✔  nx run cart:build:production (3s)

 ——————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project cart and 3 tasks it depends on (4s)
```

### Configuring the Comparison Range for Affected Commands

To understand which projects are affected, Nx uses the Git history and the [project graph](/features/explore-graph). Git knows which files changed, and the Nx project graph knows which projects those files belong to.

The affected command takes a `base` and `head` commit. The default `base` is your `main` branch and the default `head` is your current file system. This is generally what you want when developing locally, but in CI, you need to customize these values.

The goal of the CI pipeline is to make sure that the current state of the repository is a good one. To ensure this, we want to verify all the changes **since the last successful CI run** - not just since the last commit on `main`.

While you could calculate this yourself, we created the [`nrwl/nx` Circle CI orb](https://github.com/nrwl/nx-orb#background) to help with that. It provides you with the `nx/set-shas` step which automatically sets the `$NX_BASE` and `$NX_HEAD` environment variables to the correct commit SHAs for you to use in the affected command.

In order to use the `nrwl/nx` orb, you need to enable the use of third-party Circle CI orbs in your organization settings. In the Circle CI project dashboard, go to `Organization Settings -> Security` and select `Yes` under Orb Security Settings: Allow Uncertified Orbs.

![Adjust ORB Security Settings in Circle CI](/nx-cloud/tutorial/circle-orb-security.png)

### Using the Affected Commands in our Pipeline

Let's adjust our CI pipeline configuration to use the affected command. Create a new branch called `ci-affected` and create a PR with the following configuration:

```yaml {% fileName=".circleci/config.yml" highlightLines=[2,3,20,22,23] %}
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

      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1
workflows:
  build:
    jobs:
      - main
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

Merge your PR into the `main` branch when you're ready to move to the next section.

## Enable Remote Caching on Circle CI

Reducing the number of tasks to run via [affected commands](/ci/features/affected) (as seen in the previous section) is helpful, but might not be enough. By default [Nx caches the results of tasks](/features/cache-task-results) on your local machine. But CI and local developer machines are still performing the same tasks on the same code - wasting time and money. The [Nx Cloud remote cache](/ci/features/remote-cache) can eliminate that waste for you.

```{% command="pnpm nx connect" %}
$ nx g nx:connect-to-nx-cloud --quiet --no-interactive

 >  NX   Remote caching via Nx Cloud has been enabled

   In addition to the caching, Nx Cloud provides config-free distributed execution,
   UI for viewing complex runs and GitHub integration. Learn more at https://nx.app

   Your workspace is currently unclaimed. Run details from unclaimed workspaces can be viewed on cloud.nx.app by anyone
   with the link. Claim your workspace at the following link to restrict access.

   https://cloud.nx.app/orgs/workspace-setup?accessToken=[YourAccessTokenHere]
```

Click the link in the terminal to claim your workspace on [nx.app](https://nx.app). Once your workspace is successfully connected you should see an empty dashboard.

![Empty Nx Cloud Dashboard](/nx-cloud/tutorial/nx-cloud-empty-workspace.png)

Once your workspace is connected to Nx Cloud, run some tasks locally to prime the cache:

```shell
pnpm nx run-many -t lint,test,build,e2e
```

Now let's commit the changes to a new `ci-caching` branch and create a PR. The only change to the source code is adding an `nxCloudAccessToken` property to `nx.json`.

```json {% fileName="nx.json" %}
{
  ...
  "nxCloudAccessToken": "MWM4NTU..."
}
```

When Circle CI now processes our tasks they'll only take a fraction of the usual time. If you inspect the logs a little closer you'll see a note saying `[remote cache]`, indicating that the output has been pulled from the remote cache rather than running it. The full log of each command will still be printed since Nx restores that from the cache as well.

![Circle CI after enabling remote caching](/nx-cloud/tutorial/circle-ci-remote-cache.png)

The commands could be restored from the remote cache because we had run them locally before pushing the changes, thus priming the cache with the results. You can **configure** whether local runs should be read-only or read/write. [Our docs page has more details on security settings for your remote cache](/ci/concepts/cache-security).

You might also want to learn more about [how to fine-tune caching](/recipes/running-tasks/customizing-inputs) to get even better results.

Merge your PR into the `main` branch when you're ready to move to the next section.

## Parallelize Tasks across Multiple Machines

The affected command and remote caching help speed up the average CI time, but there will be some PRs that affect everything in the repository. The only way to speed up that worst case scenario is through efficient parallelization. The best way to parallelize CI with Nx is to use [distributed task execution (DTE)](/ci/features/distribute-task-execution).

Nx Cloud's DTE feature

- takes a command (e.g. `run-many -t build,lint,test,e2e`) and splits it into individual tasks which it then distributes across multiple agents
- distributes tasks by considering the dependencies between them; e.g. if `e2e` depends on `build`, Nx Cloud will make sure that `build` is executed before `e2e`; it does this across machines
- distributes tasks to optimize for CPU processing time and reduce idle time by taking into account historical data about how long each task takes to run
- collects the results and logs of all the tasks and presents them in a single view
- automatically shuts down agents when they are no longer needed

Let's enable DTE in our CI pipeline configuration. First let's define the agent which restores the NPM dependencies and then runs the `nx-cloud start-agent` command which notifies Nx Cloud that this machine is waiting to run tasks that are assigned to it. `no_output_timeout: 60m` means that this agent will automatically shut down if it doesn't receive any instructions for 60 minutes.

```yaml {% fileName=".circleci/config.yml" highlightLines=["5-25"] %}
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
          command: pnpm nx-cloud start-agent
          no_output_timeout: 60m
  main: ...
```

The `main` job looks very similar to the previous configuration, with the addition of a single line above the `nx affected` commands.

```yaml {% fileName=".circleci/config.yml" highlightLines=[24,29] %}
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  agent:
    - ...
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

      - run: pnpm nx-cloud start-ci-run --stop-agents-after="e2e"

      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1
```

- `nx-cloud start-ci-run` lets Nx know that all the tasks after this line should be orchestrated with Nx Cloud's DTE process
- `--stop-agents-after="e2e"` lets Nx Cloud know which line is the last command in this pipeline. Once there are no more e2e tasks for an agent to run, Nx Cloud will automatically shut them down. This way you're not wasting money on idle agents while a particularly long e2e task is running on a single agent.

Finally in the `workflows` section we instantiate the number of agents we want to run. The **full pipeline configuration** looks like this:

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
          command: pnpm nx-cloud start-agent
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

      - run: pnpm nx-cloud start-ci-run --stop-agents-after="e2e"

      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e --parallel=1
workflows:
  build:
    jobs:
      - agent:
          matrix:
            parameters:
              ordinal: [1, 2, 3]
      - main
```

Try it out by creating a new PR with the above changes.

Once Circle CI starts, you should see multiple agents running in parallel:

![Circle CI showing multiple DTE agents](/nx-cloud/tutorial/circle-dte-multiple-agents.png)

If you open your Nx Cloud dashboard, you'll get a better view of the individual tasks and their corresponding logs.

![Nx Cloud run details](/nx-cloud/tutorial/nx-cloud-run-details.png)

With this pipeline configuration in place, no matter how large the repository scales, Nx Cloud will adjust and distribute tasks across agents in the optimal way. If CI pipelines start to slow down, just add some agents to the `ordinal: [1, 2, 3]` array. One of the main advantages is that such a pipeline definition is declarative. We just give instructions what commands to run, but not how to distribute them. As such even if our monorepo structure changes and evolves over time, the distribution will be taken care of by Nx Cloud.

## Next Steps

You now have a highly optimized CI configuration that will scale as your repository scales. See what else you can do with Nx Cloud.

- Set up [GitHub PR integration](/ci/recipes/source-control-integration/github) to view Nx Cloud results directly in your PR
- Choose the [security settings](/ci/concepts/cache-security) that make sense for your organization
- [Record non-Nx commands](/ci/recipes/other/record-commands) and view the results in the Nx Cloud interface
