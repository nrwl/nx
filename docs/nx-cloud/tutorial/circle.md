---
title: 'Circle CI Tutorial with Nx'
description: In this tutorial you'll set up continuous integration with Circle CI and Nx
---

# Circle CI with Nx

In this tutorial, we're going to learn how to leverage Nx to set up a scalable CI pipeline on Circle CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

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
   git clone git@github.com:<your-username>/nx-shops.git
   ```

2. Install dependencies (this repo uses [PNPM](https://pnpm.io/) but you should be able to also use any other package manager)

   ```shell
   pnpm i
   ```

3. Make sure all task are working on your machine, by running lint, test, and build on all projects of the workspace

   ```shell
   pnpm nx run-many -t lint test build
   ```

## Set Up Circle CI

In order to use Circle CI, you need to [sign up and create an organization](https://circleci.com/docs/first-steps/#sign-up-and-create-an-org). Follow the steps in the Circle CI documentation to connect to your GitHub repository. When you are asked to configure a pipeline, choose any option, since we'll overwrite it.

To verify that Circle CI is set up correctly we'll create a pipeline that just logs a message. First, checkout a new branch:

## Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

To connect to Nx Cloud:

- Commit and push your changes
- Go to [https://cloud.nx.app](https://cloud.nx.app), create an account, and connect your repository

```shell
npx nx connect
```

Follow the steps and make sure Nx Cloud is enabled on the `main` branch before continuing.

## Generate a CI Workflow

Let's create a PR to add the CI workflow file.

```shell
git checkout -b ci-workflow
```

Use the following command to generate a CI workflow file.

```shell
npx nx generate ci-workflow --ci circleci
```

This generator creates a `.circleci/config.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e-ci` tasks for projects that are affected by any given PR.

The key lines in the CI pipeline are:

```yml
- run: npx nx affected -t lint test build
- run: npx nx affected -t e2e-ci --parallel 1
```

Next, commit this change, push the branch, and create a PR on your forked GitHub repository:

```shell
git commit -am "add CI workflow file"
git push -u origin
```

If everything was set up correctly, you should see a message from Circle CI in the PR with a success status.

![All checks have passed in the PR](/nx-cloud/tutorial/Circle%20PR%20passed.png)

Merge your PR into the `main` branch when you're ready to move to the next section.

## Remote Caching using Nx Replay

[Nx Cloud](https://nx.app) provides [Nx Replay](/ci/features/remote-cache), which is a powerful, scalable and, very importantly, secure way to share task artifacts across machines.

[Nx Replay](/ci/features/remote-cache) is enabled by default. To see it in action, let's create a new PR:

```shell
git checkout -b feat-1
```

We'll make a small change to the shared header library.

```ts {% filename="libs/shared/header/src/index.ts" highlightLines=[1] %}
// Some change
export * from './lib/header/header.element';
```

Commit and open a new PR.

```shell
git -am 'update header'
git push origin feat-1
```

Wait a few minutes for the CI checks to finish, and then make a change to the `README.md`.

```md {% filename="README.md" highlightLines=[1] %}
# NxCloud CI example repo (updated)

This repo is based on the [Nx Examples](https://github.com/nrwl/nx-examples) repo
but setup in a way to illustrate some of the benefits of using Nx and NxCloud together to setup CI.

...
```

Commit and push to the existing PR.

```shell
git -am 'update readme'
git push origin feat-1
```

When Circle CI now processes our tasks they'll only take a fraction of the usual time. If you inspect the logs a little closer you'll see a note saying `[remote cache]`, indicating that the output has been pulled from the remote cache rather than running it. Since `README.md` is not an input of our `build`, `test`, `lint`, `e2e-ci` tasks , Nx Replay will read the results from cache.

![Run Details with remote cache hits](/nx-cloud/tutorial/nx-cloud-run-details.png)

You might also want to learn more about [how to fine-tune caching](/recipes/running-tasks/configure-inputs) to get even better results.

Merge your PR into the `main` branch when you're ready to move to the next section.

## Parallelize Tasks Across Multiple Machines Using Nx Agents

The affected command and Nx Replay help speed up the average CI time, but there will be some PRs that affect everything in the repository. The only way to speed up that worst case scenario is through efficient parallelization. The best way to parallelize CI with Nx is to use Nx Agents.

The Nx Agents feature

- takes a command (e.g. `run-many -t build lint test`) and splits it into individual tasks which it then distributes across multiple agents
- distributes tasks by considering the dependencies between them; e.g. if `e2e-ci` depends on `build`, Nx Cloud will make sure that `build` is executed before `e2e-ci`; it does this across machines
- distributes tasks to optimize for CPU processing time and reduce idle time by taking into account historical data about how long each task takes to run
- collects the results and logs of all the tasks and presents them in a single view
- automatically shuts down agents when they are no longer needed

Nx Agents are enabled by the following line.

```
npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
```

We recommend you add this line right after you check out the repo, before installing node modules.

- `nx-cloud start-ci-run --distribute-on="3 linux-medium-js` lets Nx know that all the tasks after this line should using Nx Agents and that Nx Cloud should use 3 instances of the `linux-medium-js` launch template. See below on how to configure a custom launch template.
- `--stop-agents-after="e2e-ci"` lets Nx Cloud know which line is the last command in this pipeline. Once there are no more e2e tasks for an agent to run, Nx Cloud will automatically shut them down. This way you're not wasting money on idle agents while a particularly long e2e task is running on a single agent.

Try it out by creating a new PR with the above changes.

Once Circle CI starts, you should see multiple agents running in parallel similar to this:

![CIPE Agents In Progress](/nx-cloud/tutorial/cipe-agents-in-progress.png)

With this pipeline configuration in place, no matter how large the repository scales, Nx Cloud will adjust and distribute tasks across agents in the optimal way. If CI pipelines start to slow down, just add some agents. One of the main advantages is that this pipeline definition is declarative. We tell Nx what commands to run, but not how to distribute them. That way even if our monorepo structure changes and evolves over time, the distribution will be taken care of by Nx Cloud.

### Running Commands Without Distribution

Sometimes you want to distribute most of your commands, but run some of them in Circle CI. You can do this with the `--no-agents` flag as follows:

```yaml {% fileName=".circleci/config.yml" highlightLines=[25] %}
version: 2.1
orbs:
  nx: nrwl/nx@1.5.1
jobs:
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="e2e-ci"
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

      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t lint test build --parallel 3
      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t e2e-ci --parallel 1
      - run: pnpm nx affected --base=$NX_BASE --head=$NX_HEAD -t deploy --no-agents # run without distribution
workflows:
  build:
    jobs:
      - main
```

## Next Steps

You now have a highly optimized CI configuration that will scale as your repository scales. See what else you can do with Nx Cloud.

- Configure [dynamic agent allocation](/ci/features/dynamic-agents)
- Learn about [automatically splitting e2e tasks](/ci/features/split-e2e-tasks)
- Identify and re-run [flaky tasks](/ci/features/flaky-tasks)
