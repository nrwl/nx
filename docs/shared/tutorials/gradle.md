---
title: 'Gradle Tutorial'
description: In this tutorial you'll add Nx to an existing Gradle repo
---

# Gradle Tutorial

In this tutorial, you'll learn how to add Nx to a repository with an existing Gradle setup. You'll see how Nx can
provide immediate value.

## Prerequisites

Make sure that you have [Gradle](https://gradle.org/) installed on your system.
Consult [Gradle's installation guide](https://docs.gradle.org/current/userguide/installation.html) for instruction that
are specific to your operating system.

To verify that Gradle was installed correctly, run this command:

```shell
gradle --version
```

Nx also requires NodeJS to be installed. If you do not have NodeJS installed, you can
install it from the [NodeJS website](https://nodejs.org/en/download).

```shell
node -v
```

## Getting Started

This tutorial picks up where [Spring framework](https://spring.io/)'s guide for [Multi-Module Projects](https://spring.io/guides/gs/multi-module) leaves off.

Fork [the sample repository](https://github.com/nrwl/gradle-tutorial):

[https://github.com/nrwl/gradle-tutorial](https://github.com/nrwl/gradle-tutorial)

And then clone it on your local machine:

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

To add Nx, run `npx nx@latest init`.

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

{% project-details title="Project Details View" jsonFile="shared/tutorials/gradle-pdv.json" %}
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

## Run Tasks for Affected Projects

Nx doesn't just cache your task results, it can also [eliminate the need to run unnecessary tasks](/ci/features/affected).

First, commit any outstanding changes to the `main` branch locally:

```shell
git commit -am "changes"
```

Next make a small change to the `application` code:

```java {% fileName="application/src/main/java/com/example/multimodule/application/DemoApplication.java" highlightLines=[21] %}
package com.example.multimodule.application;

import com.example.multimodule.service.MyService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication(scanBasePackages = "com.example.multimodule")
@RestController
public class DemoApplication {

    private final MyService myService;

    public DemoApplication(MyService myService) {
        this.myService = myService;
    }

    @GetMapping("/")
    public String home() {
        return myService.message() + " changed!";
    }

    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

As a developer, we know that this change only affects the `application` project, not the `library` project. We would
run `./nx run application:test` to verify our changes. In CI, teams often run all test tasks rerunning
the `library:test` task unnecessarily.

For a repository with only a few projects, you can manually calculate which projects are affected. As the repository grows, it becomes critical to have a tool like Nx that understands the project dependency graph and eliminates wasted time in CI.

The `./nx affected` command solves this problem. Nx uses its project graph in conjunction with git history to only run
tasks for projects that may have been affected by the changes that you made.

To run the `test` tasks for projects affected by this change, run:

```shell
./nx affected -t test
```

Notice that this command does not run the `test` task for the `library` project, since it could not have been affected by the code change.

## Set Up CI for Your Gradle Workspace

This tutorial walked you through how Nx can improve the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Generate a CI Workflow

If you are starting a new project, you can use the following command to generate a CI workflow file.

```shell
npx nx generate ci-workflow --ci=github
```

{% callout type="note" title="Choose your CI provider" %}
You can choose `github`, `circleci`, `azure`, `bitbucket-pipelines`, or `gitlab` for the `ci` flag.
{% /callout %}

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR.

The key line in the CI pipeline is:

```yml
- run: npx nx affected -t lint test build e2e-ci
```

### Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

To connect to Nx Cloud:

- Commit and push your changes
- Go to [https://cloud.nx.app](https://cloud.nx.app), create an account, and connect your repository

#### Connect to Nx Cloud Manually

If you are not able to connect via the automated process at [https://cloud.nx.app](https://cloud.nx.app), you can connect your workspace manually by running:

```shell
npx nx connect
```

You will then need to merge your changes and connect to your workspace on [https://cloud.nx.app](https://cloud.nx.app).

### Enable a Distributed CI Pipeline

The current CI pipeline runs on a single machine and can only handle small workspaces. To transform your CI into a CI that runs on multiple machines and can handle workspaces of any size, uncomment the `npx nx-cloud start-ci-run` line in the `.github/workflows/ci.yml` file.

```yml
# Connect your workspace on nx.app and uncomment this to enable task distribution.
# The "--stop-agents-after" is optional, but allows idle agents to shut down once the "build" targets have been requested
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-jvm" --stop-agents-after="build"
```

![Gradle run details](/shared/tutorials/gradle-run-details.webp)

For more information about how Nx can improve your CI pipeline, check out one of these detailed tutorials:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Summary

Now that you have added Nx to this sample Gradle repository, you have learned several ways that Nx can help your
organization:

- Nx reflects the Gradle graph into the Nx graph
- Nx's dependency graph visualisation helps you understand your codebase
- Nx caches task results and reuses them when the same task is rerun later
- Nx intelligently determines which tasks are `affected` by code changes to reduce waste in CI
- Nx Cloud provides remote caching and distributed task execution to speed up CI

## Next Steps

Connect with the rest of the Nx community with these resources:

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about
  Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
