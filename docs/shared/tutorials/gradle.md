---
title: 'Gradle Tutorial'
description: In this tutorial you'll add Nx to an existing Gradle repo
---

# Gradle Tutorial

This tutorial walks you through adding Nx to an existing Gradle project. You'll see how Nx enhances your Gradle workflow with caching, task orchestration, and better developer experience.

What you'll learn:

- How to integrate Nx with your existing Gradle build system
- How Nx's caching speeds up your Gradle builds locally and in CI
- How to visualize and understand project dependencies in your Gradle workspace
- How to run Gradle tasks more efficiently with Nx's task runner
- How to set up Nx Cloud for distributed caching and faster CI

## Prerequisites

Make sure that you have [Gradle](https://gradle.org/) installed on your system.
Consult [Gradle's installation guide](https://docs.gradle.org/current/userguide/installation.html) for instruction that
are specific to your operating system.

To verify that Gradle was installed correctly, run this command:

```shell
gradle --version
```

To streamline this tutorial, we'll install Nx globally on your system. You can use Homebrew (Mac and Linux) or a manually installed Node version (any OS).

{% tabs %}
{% tab label="Homebrew" %}

Make sure [Homebrew is installed](https://brew.sh/), then install Nx globally with these commands:

```shell
brew install nx
```

{% /tab %}
{% tab label="Node" %}

Install node from the [NodeJS website](https://nodejs.org/en/download), then install Nx globally with this command:

```shell
npm install --global nx
```

{% /tab %}
{% /tabs %}

## Getting Started

This tutorial picks up where [Spring framework](https://spring.io/)'s guide for [Multi-Module Projects](https://spring.io/guides/gs/multi-module) leaves off.

Fork [the sample repository](https://github.com/nrwl/gradle-tutorial/fork), and then clone it on your local machine:

```shell
git clone https://github.com/<your-username>/gradle-tutorial.git
```

The Multi-Module Spring Tutorial left us with 2 projects:

- The main `application` project which contains the Spring `DemoApplication`
- A `library` project which contains a Service used in the `DemoApplication`

You can see the above 2 projects by running `./gradlew projects`

```text {% command="./gradlew projects" %}
> Task :projects

------------------------------------------------------------
Root project 'gradle-tutorial'
------------------------------------------------------------

Root project 'gradle-tutorial'
+--- Project ':application'
\--- Project ':library'

```

## Add Nx

Nx is a build system with built in tooling and advanced CI capabilities. It helps you maintain and scale monorepos,
both locally and on CI. We will explore the features of Nx in this tutorial by adding it to the Gradle workspace above.

To add Nx, run

```shell {% path="~/gradle-tutorial" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it. Nx will
also detect Gradle is used in the repo so it will propose adding the `@nx/gradle` plugin to integrate Gradle with Nx.
Select the plugin and continue with the setup.

Similar to Gradle, Nx can be run with the `nx` or `nx.bat` executables. We will learn about some of the Nx commands in
the following sections.

## Explore Your Workspace

Like Gradle, Nx understands your workspace as a graph of projects. Nx uses this graph for many things which we will
learn about in following sections. To visualize this graph in your browser, Run the following command and click the
"Show all projects" button in the left sidebar.

You will recognize that the projects which are shown, are the same projects which Gradle shows.
The `@nx/gradle` plugin reflects the graph of projects in Gradle into the Nx Project Graph. As projects
are created, deleted, and change their dependencies, Nx will automatically recalculate the graph. Exploring this graph
visually is vital to understanding how your code is structured and how Nx and Gradle behaves.

{% tabs %}
{% tab label="Mac/Linux" %}

```shell
./nx graph
```

{% /tab %}
{% tab label="Windows" %}

```shell
./nx.bat graph
```

{% /tab %}
{% /tabs %}

{% graph title="Gradle Projects" height="200px" jsonFile="shared/tutorials/gradle-project-graph.json" %}
{% /graph %}

## Running Tasks

Nx is a task runner built for monorepos. It can run a single task for a single project, a task for all projects, and
even intelligently run a subset of tasks based on the changes you've made in your repository. Nx also has sophisticated
computation caching to reuse the results of tasks. We will explore how Nx adds to the task running Gradle provides.

Before we start running tasks, let's explore the tasks available for the `application` project. The `@nx/gradle` plugin
that we've installed reflects Gradle's tasks to Nx, which allows it to run any of the Gradle tasks defined for that project. You can view the available tasks either through [Nx Console](/getting-started/editor-setup) or from the terminal:

```shell {% path="~/gradle-tutorial" %}
./nx show project application --web
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/gradle-pdv.json" expandedTargets=["build"] height="520px" %}
{% /project-details %}

The Nx command to run the `build` task for the `application` project is:

```shell
./nx run application:build
```

When Nx runs a Gradle task, it hands off the execution of that task to Gradle, so all task dependencies and
configuration settings in the Gradle configuration are still respected.

By running the task via Nx, however, the task computation was cached for reuse. Now, running `./nx run application:build`
again, will complete almost instantly as the result from the previous execution will be used.

```{% command="./nx run application:build" %}

   ✔  1/1 dependent project tasks succeeded [1 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run application:classes  [existing outputs match the cache, left as is]

> ./gradlew :application:classes

> Task :library:compileJava UP-TO-DATE
> Task :library:processResources NO-SOURCE
> Task :library:classes UP-TO-DATE
> Task :library:jar UP-TO-DATE
> Task :application:compileJava UP-TO-DATE
> Task :application:processResources UP-TO-DATE
> Task :application:classes UP-TO-DATE

BUILD SUCCESSFUL in 647ms
4 actionable tasks: 4 up-to-date

> nx run application:build  [existing outputs match the cache, left as is]

> ./gradlew :application:build


Deprecated Gradle features were used in this build, making it incompatible with Gradle 9.0.

You can use '--warning-mode all' to show the individual deprecation warnings and determine if they come from your own scripts or plugins.

For more on this, please refer to https://docs.gradle.org/8.5/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.

BUILD SUCCESSFUL in 768ms
9 actionable tasks: 1 executed, 8 up-to-date

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Successfully ran target build for project application and 3 tasks it depends on (30ms)

Nx read the output from the cache instead of running the command for 4 out of 4 tasks.
```

Now that we've run one task, let's run all the `build` tasks in the repository with the Nx `run-many` command. This is similar to Gradle's `./gradlew build` command.

```{% command="./nx run-many -t build" %}

   ✔  nx run library:classes  [existing outputs match the cache, left as is]
   ✔  nx run library:build  [existing outputs match the cache, left as is]
   ✔  nx run application:classes  [existing outputs match the cache, left as is]
   ✔  nx run application:build  [existing outputs match the cache, left as is]
   ✔  nx run gradle-tutorial:classes (1s)
   ✔  nx run gradle-tutorial:build (1s)

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Successfully ran target build for 3 projects and 3 tasks they depend on (2s)

Nx read the output from the cache instead of running the command for 4 out of 6 tasks.
```

Again, because Nx cached the tasks when the application was built, most of the tasks here were near instant. The only
ones which needed to be done is the root project's build. Running the command one more time, will be near instant as
then all the tasks will be restored from the cache.

## Fast CI ⚡ {% highlightColor="green" %}

{% callout type="check" title="Repository with Nx" %}
Make sure you have completed the previous sections of this tutorial before starting this one. If you want a clean starting point, you can check out the [reference code](https://github.com/nrwl/nx-recipes/tree/main/gradle) as a starting point.
{% /callout %}

This tutorial walked you through how Nx can improve the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Connect to Nx Cloud {% highlightColor="green" %}

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

{% call-to-action title="Get Started with Nx Cloud Free 🎯" url="https://cloud.nx.app/create-nx-workspace?preset=gradle" description="Cut CI times by 70% - Enterprise-grade caching & distribution at no cost" /%}

Now that we're working on the CI pipeline, it is important for your changes to be pushed to a GitHub repository.

1. Commit your existing changes with `git add . && git commit -am "updates"`
2. [Create a new GitHub repository](https://github.com/new)
3. Follow GitHub's instructions to push your existing code to the repository

Now connect your repository to Nx Cloud with the following command:

```shell
./nx connect
```

A browser window will open to register your repository in your [Nx Cloud](https://cloud.nx.app) account. The link is also printed to the terminal if the windows does not open, or you closed it before finishing the steps. The app will guide you to create a PR to enable Nx Cloud on your repository.

![](/shared/tutorials/nx-cloud-github-connect.avif)

Once the PR is created, merge it into your main branch.

![](/shared/tutorials/github-cloud-pr-merged.avif)

And make sure you pull the latest changes locally:

```shell
git pull
```

You should now have an `nxCloudId` property specified in the `nx.json` file.

### Create a CI Workflow {% highlightColor="green" %}

Let's create a branch to add a CI workflow.

```shell
git checkout -b add-workflow
```

And use the following command to generate a CI workflow file.

```shell
./nx generate ci-workflow --ci=github
```

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR. If you would like to also distribute tasks across multiple machines to ensure fast and reliable CI runs, uncomment the `nx-cloud start-ci-run` line.

The key lines in the CI pipeline are:

```yml {% fileName=".github/workflows/ci.yml" highlightLines=["22-26", "38-39"] %}
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: tree:0

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Uncomment this line to enable task distribution
      # - run: ./nx start-ci-run --distribute-on="3 linux-medium-jvm" --stop-agents-after="build"

      - name: Set up JDK 21 for x64
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          architecture: x64

      - name: Setup Gradle
        uses: gradle/gradle-build-action@v2

      # As your workspace grows, you can change this to use Nx Affected to run only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
      - run: './nx run-many -t test build'
      # Nx Cloud recommends fixes for failures to help you get CI green faster. Learn more: https://nx.dev/ci/features/self-healing-ci
      - run: ./nx fix-ci
        if: always()
```

### Open a Pull Request {% highlightColor="green" %}

Commit the changes and open a new PR on GitHub.

```shell
git add .
git commit -m 'add CI workflow file'
git push origin add-workflow
```

When you view the PR on GitHub, you will see a comment from Nx Cloud that reports on the status of the CI run.

![Nx Cloud report](/shared/tutorials/gradle-github-pr-cloud-report.avif)

The `See all runs` link goes to a page with the progress and results of tasks that were run in the CI pipeline.

![Gradle run details](/shared/tutorials/gradle-run-details.webp)

For more information about how Nx can improve your CI pipeline, check out one of these guides:

- [GitHub Actions with Nx](/ci/recipes/set-up/monorepo-ci-github-actions)
- [Circle CI with Nx](/ci/recipes/set-up/monorepo-ci-circle-ci)
- [Azure Pipelines with Nx](/ci/recipes/set-up/monorepo-ci-azure)
- [Bitbucket Pipelines with Nx](/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines)
- [GitLab with Nx](/ci/recipes/set-up/monorepo-ci-gitlab)

## Summary

Now that you have added Nx to this sample Gradle repository, you have learned several ways that Nx can help your
organization:

- Nx reflects the Gradle graph into the Nx graph
- Nx's dependency graph visualisation helps you understand your codebase
- Nx caches task results and reuses them when the same task is rerun later
- Nx Cloud provides remote caching and distributed task execution to speed up CI
- Nx [intelligently determines which tasks are `affected`](/ci/features/affected) by code changes to reduce waste in CI

## Next Steps

Connect with the rest of the Nx community with these resources:

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about
  Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
