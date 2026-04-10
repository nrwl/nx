---
title: 'Circle CI Tutorial with Nx'
description: In this tutorial you'll set up continuous integration with Circle CI and Nx
---

# Circle CI with Nx

In this tutorial we're going to learn how to leverage Nx to setup a scalable CI pipeline on Circle CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

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
   git clone https://github.com/<your-username>/nx-shops.git
   ```

2. Install dependencies (this repo uses [PNPM](https://pnpm.io/) but you should be able to also use any other package manager)

   ```shell
   pnpm i
   ```

3. Make sure all tasks are working on your machine, by running lint, test, build and e2e on all projects of the workspace

   ```shell
   pnpm nx run-many -t lint test build
   ```

## Connect to Circle CI

In order to use Circle CI, you need to [sign up and create an organization](https://circleci.com/docs/first-steps/#sign-up-and-create-an-org). Follow the steps in the Circle CI documentation to connect to your GitHub repository to a project.

![](/nx-cloud/tutorial/circle-setup-project.avif)

The easiest way is to create a branch and PR in your GitHub repository. Note that a sample pipeline workflow file will be created, which we will overwrite in the next step.

![](/nx-cloud/tutorial/circle-create-pr.avif)

Once the PR is created, merge it into your main branch.

![](/nx-cloud/tutorial/circle-pr.avif)

And pull the changes locally:

```shell
git pull
```

## Create a CI Workflow

First, we'll create a new branch to start adding a CI workflow.

```shell
git checkout -b setup-ci
```

Now we can use an Nx generator to create a default CI workflow file.

```shell
pnpm nx generate ci-workflow --ci=circleci
```

This generator will overwrite Circle CI's default `.circleci/config.yml` file to create a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR.

The key lines in the CI pipeline are:

```yml {% fileName=".circleci/config.yml" highlightLines=["27-29"] %}
version: 2.1

orbs:
  nx: nrwl/nx@1.6.2

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout

      - run:
          name: Install PNPM
          command: npm install --prefix=$HOME/.local -g pnpm@8

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this
      # - run: pnpm dlx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"

      - run: pnpm install --frozen-lockfile
      - nx/set-shas:
          main-branch-name: 'main'

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - run: pnpm exec nx-cloud record -- echo Hello World
      - run: pnpm exec nx affected --base=$NX_BASE --head=$NX_HEAD -t lint test build e2e-ci

workflows:
  version: 2

  ci:
    jobs:
      - main
```

The [`nx affected` command](/ci/features/affected) will run the specified tasks only for projects that have been affected by a particular PR, which can save a lot of time as repositories grow larger.

Commit your changes and push your branch:

```shell
git add .
git commit -am "basic ci workflow"
git push -u origin HEAD
```

Open up a new PR to see the run on CircleCI. If you see a message about the `nrwl/nx` orb not being loaded, you need to enable third-party CircleCI orbs in your organization settings. In the Circle CI project dashboard, go to `Organization Settings -> Security` and select `Yes` under Orb Security Settings: Allow Uncertified Orbs.

![](/nx-cloud/tutorial/circle-orb-security.png)

{% callout type="warning" title="Create Your PR on Your Own Repository" %}
Make sure that the PR you create is against your own repository's `main` branch - not the `nrwl/nx-shops` repository.
{% /callout %}

![](/nx-cloud/tutorial/circle-new-run.avif)

Once CI is green, merge the PR.

![](/nx-cloud/tutorial/github-pr-workflow.avif)

And make sure to pull the changes locally:

```shell
git checkout main
git pull origin main
```

The rest of the tutorial covers remote caching and distribution across multiple machines, which need Nx Cloud to be enabled. Let's set that up next.

## Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e test deflaking, better DX and more.

Let's connect your repository to Nx Cloud with the following command:

```shell
pnpm nx connect
```

A browser window will open to register your repository in your [Nx Cloud](https://cloud.nx.app) account. The link is also printed to the terminal if the windows does not open, or you closed it before finishing the steps. The app will guide you to create a PR to enable Nx Cloud on your repository.

![](/nx-cloud/tutorial/nx-cloud-setup.avif)

Nx Cloud will create a comment on your PR that gives you a summary of the CI run and a link to dig into logs and understand everything that happened during the CI run.

![Nx Cloud report comment](/nx-cloud/tutorial/nx-cloud-report-comment.png)

Once the PR is green, merge it into your main branch.

![](/nx-cloud/tutorial/github-cloud-pr.avif)

And make sure you pull the latest changes locally:

```shell
git pull
```

You should now have an `nxCloudId` property specified in the `nx.json` file.

## Understand Remote Caching

[Nx Cloud](https://nx.app) provides [Nx Replay](/ci/features/remote-cache), which is a powerful, scalable and, very importantly, secure way to share task artifacts across machines. It lets you configure permissions and guarantees the cached artifacts cannot be tempered with.

[Nx Replay](/ci/features/remote-cache) is enabled by default. We can see it in action by running a few commands locally. First, let's build every project in the repository:

```shell
pnpm nx run-many -t build
```

Nx will store the output of those tasks locally in the `.nx/cache` folder and remotely in Nx Cloud. If someone else in the organization were to run the same `build` command on the same source code, they would receive the remotely cached outputs instead of re-running the `build` task themselves. We can simulate this by deleting the `.nx/cache` folder and re-running the `build` command.

```shell
rm -rf .nx/cache
pnpm nx run-many -t build
```

The `build` tasks complete almost instantly, and you can see in the logs that Nx has pulled the outputs from the remote cache:

```
❯ nx run-many -t build

   ✔  nx run shared-product-types:build  [remote cache]
   ✔  nx run shared-product-ui:build  [remote cache]
   ✔  nx run shared-header:build  [remote cache]
   ✔  nx run landing-page:build:production  [remote cache]
   ✔  nx run admin:build:production  [remote cache]
   ✔  nx run cart:build:production  [remote cache]
```

This remote cache is useful to speed up tasks when developing on a local machine, but it is incredibly useful for CI to be able share task results across different CI pipeline executions. When a small commit is added to a large PR, the CI is able to download the results for most of the tasks instead of recomputing everything from scratch.

You might also want to learn more about [how to fine-tune caching](/recipes/running-tasks/configure-inputs) to get even better results.

## Parallelize Tasks Across Multiple Machines Using Nx Agents

The affected command and Nx Replay help speed up the average CI time, but there will be some PRs that affect everything in the repository. The only way to speed up that worst case scenario is through efficient parallelization. The best way to parallelize CI with Nx is to use [Nx Agents](/ci/features/distribute-task-execution).

The Nx Agents feature

- takes a command (e.g. `nx affected -t build lint test e2e-ci`) and splits it into individual tasks which it then distributes across multiple agents
- distributes tasks by considering the dependencies between them; e.g. if `e2e-ci` depends on `build`, Nx Cloud will make sure that `build` is executed before `e2e-ci`; it does this across machines
- distributes tasks to optimize for CPU processing time and reduce idle time by taking into account historical data about how long each task takes to run
- collects the results and logs of all the tasks and presents them in a single view
- automatically shuts down agents when they are no longer needed

To enable Nx Agents, make sure the following line is uncommented in the `.circleci/config.yml` file.

```yml {% fileName=".circleci/config.yml" highlightLines=["21"] %}
version: 2.1

orbs:
  nx: nrwl/nx@1.6.2

jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout

      - run:
          name: Install PNPM
          command: npm install --prefix=$HOME/.local -g pnpm@8

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this
      - run: pnpm dlx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"

      - run: pnpm install --frozen-lockfile
      - nx/set-shas:
          main-branch-name: 'main'

      # Prepend any command with "nx-cloud record --" to record its logs to Nx Cloud
      # - run: pnpm exec nx-cloud record -- echo Hello World
      - run: pnpm exec nx affected --base=$NX_BASE --head=$NX_HEAD -t lint test build e2e-ci

workflows:
  version: 2

  ci:
    jobs:
      - main
```

We recommend you add this line right after you check out the repo, before installing node modules.

- `nx-cloud start-ci-run --distribute-on="3 linux-medium-js` lets Nx know that all the tasks after this line should use Nx Agents and that Nx Cloud should use three instances of the `linux-medium-js` launch template. See the separate reference on how to [configure a custom launch template](/ci/reference/launch-templates).
- `--stop-agents-after="e2e-ci"` lets Nx Cloud know which line is the last command in this pipeline. Once there are no more e2e tasks for an agent to run, Nx Cloud will automatically shut them down. This way you're not wasting money on idle agents while a particularly long e2e task is running on a single agent.

Try it out by creating a new PR with the above changes.

```shell
git checkout -b enable-distribution
git commit -am 'enable task distribution'
```

![](/nx-cloud/tutorial/github-pr-distribution.avif)

Once Circle CI starts, you can click on the Nx Cloud report to see what tasks agents are executing in real time.

![](/nx-cloud/tutorial/nx-cloud-distribution.avif)

With this pipeline configuration in place, no matter how large the repository scales, Nx Cloud will adjust and distribute tasks across agents in the optimal way. If CI pipelines start to slow down, just add some agents. One of the main advantages is that this pipeline definition is declarative. We tell Nx what commands to run, but not how to distribute them. That way even if our monorepo structure changes and evolves over time, the distribution will be taken care of by Nx Cloud.

## Next Steps

You now have a highly optimized CI configuration that will scale as your repository scales. See what else you can do with Nx Cloud.

- Configure [dynamic agent allocation](/ci/features/dynamic-agents)
- Learn about [automatically splitting e2e tasks](/ci/features/split-e2e-tasks)
- Identify and re-run [flaky tasks](/ci/features/flaky-tasks)
