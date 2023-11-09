---
title: 'Circle CI Tutorial with Nx'
description: In this tutorial you'll set up continuous integration with Circle CI and Nx
---

# Circle CI with Nx

Continuous integration (CI) is critical to a well-functioning software development process.  Without CI, you are either shipping bugs directly to production, or you have to spend a long time testing and retesting your software every time you make a release.  You suffer either in reliability or throughput - and usually both.

With a quality CI pipeline in place, every merged pull request is checked with a baseline set of tests so that you have the confidence to deploy more frequently without increasing the failure rate of your deployments.  When setting up the CI pipeline, you also have to be careful to keep the pipeline performant so that you aren't unnecessarily extending the lead time for changes.

This tutorial will show you how to solve all these problems with Nx and Nx Cloud, using Circle CI as the CI provider.

## Starting Repository

{% graph height="400px" jsonFile="nx-cloud/tutorial/repo-graph.json" %}
{% /graph %}

Small intro to the repo we’ll be using
It will have some frontend and backend apps. The apps themselves don’t matter, we just need a good coverage of lint/test/e2e tests

- clone the sample repo, or use a repo from one of the [Learn Nx tutorials](https://nx.dev/getting-started/intro#learn-nx)
- the code doesn't matter much for this tutorial, but we want multiple projects that depend on each other and defined lint, test, build and e2e targets.

## Set-up CircleCI

https://circleci.com/docs/first-steps/#sign-up-and-create-an-org

- sign up, create an organization
- connect to github
- choose any pipeline configuration, we'll replace it

simple script that will just echo a string. We’re just triggering CircleCI here

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

Commit this change on a branch
Push the branch to your repo
Create a PR from the branch to main
If everything was set up correctly, you should see a message from Circle CI in the PR with a success status.
Click on the job details and you should see the `Hello Circle CI` message in the logs.

## Use Nx in CI

Run an nx build

In order to use Nx in CI, we need to checkout the repo, install NPM dependencies, and cache the NPM dependencies.

Then we can run any Nx command - in this case - `nx build cart`
and run an “nx build”

https://circleci.com/docs/caching/

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
          key: v1-deps-{{ checksum "package-lock.json" }}
      # install dependencies
      - run:
          name: install dependencies
          command: npm ci
      # save any changes to the cache
      - save_cache:
          key: v1-deps-{{ checksum "package-lock.json" }}
          paths:
            - node_modules
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

## Nx affected

show locally how we can “run-many -t build”. That will be slow for CI
run nx affected build

```{% command="nx run-many -t build" %}
> nx run tuskdesk:lint

Linting "tuskdesk"...

    Error: You have attempted to use a lint rule which requires the full
    TypeScript type-checker to be available, but you do not have
    `parserOptions.project` configured to point at your project
    tsconfig.json files in the relevant TypeScript file "overrides"
    block of your project ESLint config `apps/tuskdesk/.eslintrc.json`

```


add a bunch of other targets: lint, test etc. Run them all with the same affected command.
explain the “base”

- could use origin/main as the base
- nx orb to set the base
  explain the “–parallel” flag. Configure it differently for builds, e2e, and some of the other targets.

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
          key: v1-deps-{{ checksum "package-lock.json" }}
      - run: npm ci
      - save_cache:
          key: v1-deps-{{ checksum "package-lock.json" }}
          paths:
            - node_modules
      - nx/set-shas

      - run: npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
workflows:
  build:
    jobs:
      - main
```

## Add caching

show quickly that it works locally
but in CI we don’t have a cache…yet.
add “nx cloud”. Explain mental model. Briefly, preferably with a graph. Maybe insert parts from the NxCloud overview video I created. This section needs to be brief. We’ll a “concepts” article later.
show a before and after comparison of how long the tasks took and how much caching can make a difference.

```shell
nx connect
```

## DTE

everything runs on one agent now…it will get slow.
We can always speed up the avg use-case with distribution, but the worst-case running time can be especially sped up.
Optional - should we explain binning?
run build on one agent, e2e on another, lint and test on another
show how the “e2e” agent, and build agent run tests twice.
Configure DTE and add a bunch of CircleCI agents
explain “stop-agents-after”, “stop-all-agents” etc.
the “launching processes in parallel but wait for them to finish” bash syntax will be a pain to explain

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
      - run: npm ci
      - run:
          command: npx nx-cloud start-agent
          no_output_timeout: 60m
  main:
    docker:
      - image: cimg/node:lts-browsers
    steps:
      - checkout
      - run: npm ci
      - nx/set-shas
      - run: npx nx-cloud start-ci-run --stop-agents-after="build"
      - run: npx nx-cloud record -- npx nx format:check
      - run: npx nx affected --base=$NX_BASE --head=$NX_HEAD -t lint,test,build --parallel=3 --configuration=ci
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
