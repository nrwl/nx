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
- How to set up Nx Cloud for faster and self-healing CI

## Ready to start?

{% callout type="note" title="Prerequisites" %}
This tutorial requires a [GitHub account](https://github.com) to demonstrate the full value of **Nx** - including task running, caching, and CI integration.
{% /callout %}

### Step 1: Setup local env

Make sure that you have [Gradle](https://gradle.org/) installed on your system.
Consult [Gradle's installation guide](https://docs.gradle.org/current/userguide/installation.html) for instruction that
are specific to your operating system.

To verify that Gradle was installed correctly, run this command:

```shell
gradle --version
```

To streamline this tutorial, we'll install Nx globally on your system. You can use your preferred installation method below based on your OS:

{% tabs %}
{% tab label="Homebrew (macOS, Linux)" %}

Make sure [Homebrew is installed](https://brew.sh/), then install Nx globally with these commands:

```shell
brew install nx
```

{% /tab %}
{% tab label="Chocolatey (Windows)" %}

```shell
choco install nx
```

{% /tab %}
{% tab label="apt (Ubuntu)" %}

```shell
sudo add-apt-repository ppa:nrwl/nx
sudo apt update
sudo apt install nx
```

{% /tab %}

{% tab label="Node (any OS)" %}

Install node from the [NodeJS website](https://nodejs.org/en/download), then install Nx globally with this command:

```shell
npm install --global nx
```

{% /tab %}
{% /tabs %}

### Step 2: Fork sample repository

This tutorial picks up where [Spring framework](https://spring.io/)'s guide for [Multi-Module Projects](https://spring.io/guides/gs/multi-module) leaves off.

Fork [the sample repository](https://github.com/nrwl/gradle-tutorial/fork), and then clone it on your local machine:

```shell
git clone https://github.com/<your-username>/gradle-tutorial.git
```

The Multi-Module Spring Tutorial left us with 2 projects:

- The main `application` project which contains the Spring `DemoApplication`
- A `library` project which contains a Service used in the `DemoApplication`

You can see the above 2 projects by running `./gradlew projects`

```text {% command="./gradlew projects" path="~/gradle-tutorial" %}
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
nx init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it. Nx will
also detect Gradle is used in the repo so it will propose adding the `@nx/gradle` plugin to integrate Gradle with Nx.

1. You'll also be prompted to add Nx Cloud, select "yes"
2. Select the plugin and continue with the setup.

Finally, commit and push all the changes to GitHub and proceed with finishing your Nx Cloud setup.

### Finish Nx Cloud setup

> Nx Cloud provides self-healing CI, remote caching and many other features. [Learn more about Nx Cloud features](/ci/features).

Click the link printing in your terminal, or you can [finish setup in Nx Cloud](https://cloud.nx.app/setup/connect-workspace/github/select)

{% call-to-action variant="simple" title="Finish Nx Cloud Setup" url="https://cloud.nx.app/setup/connect-workspace/github/select" /%}

### Verify your setup

Please verify closely that you have the following setup:

1. A new Nx workspace on your local machine
2. A corresponding GitHub repository for the workspace
3. You completed the full Nx Cloud onboarding, and you now have a Nx Cloud dashboard that is connected to your example repository on GitHub.

You should see your workspace in your [Nx Cloud organization](https://cloud.nx.app/orgs).

## Explore Your Workspace

Like Gradle, Nx understands your workspace as a graph of projects. Nx uses this graph for many things which we will
learn about in following sections. To visualize this graph in your browser, Run the following command and click the
"Show all projects" button in the left sidebar.

You will recognize that the projects which are shown, are the same projects which Gradle shows.
The `@nx/gradle` plugin reflects the graph of projects in Gradle into the Nx Project Graph. As projects
are created, deleted, and change their dependencies, Nx will automatically recalculate the graph. Exploring this graph
visually is vital to understanding how your code is structured and how Nx and Gradle behaves.

```shell {% path="~/gradle-tutorial" %}
nx graph
```

{% graph title="Gradle Projects" height="200px" jsonFile="shared/tutorials/gradle-project-graph.json" %}
{% /graph %}

## Running Tasks

Nx is a task runner built for monorepos. It can run a single task for a single project, a task for all projects, and
even intelligently run a subset of tasks based on the changes you've made in your repository. Nx also has sophisticated
computation caching to reuse the results of tasks. We will explore how Nx adds to the task running Gradle provides.

Before we start running tasks, let's explore the tasks available for the `application` project. The `@nx/gradle` plugin
that we've installed reflects Gradle's tasks to Nx, which allows it to run any of the Gradle tasks defined for that project. You can view the available tasks either through [Nx Console](/getting-started/editor-setup) or from the terminal:

```shell {% path="~/gradle-tutorial" %}
nx show project application
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/gradle-pdv.json" expandedTargets=["build"] height="520px" %}
{% /project-details %}

The Nx command to run the `build` task for the `application` project is:

```shell {% path="~/gradle-tutorial" %}
nx run application:build
```

When Nx runs a Gradle task, it hands off the execution of that task to Gradle, so all task dependencies and
configuration settings in the Gradle configuration are still respected.

By running the task via Nx, however, the task computation was cached for reuse. Now, running `nx run application:build`
again, will complete almost instantly as the result from the previous execution will be used.

```text {% command="nx run application:build" path="~/gradle-tutorial"%}

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

```text {% command="nx run-many -t build" path="~/gradle-tutorial"%}

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

### Remote Cache for Faster Development

With Nx Cloud connected, your task results are now cached remotely. This means that if another developer runs the same tasks, or if you run them in CI, the results will be retrieved from the remote cache instead of being re-executed.

Try running the build again after making a small change to see how Nx intelligently determines which tasks need to be re-run:

```shell {% path="~/gradle-tutorial" %}
nx run-many -t build
```

You'll notice that only the affected projects need to rebuild, while others are restored from cache.

## Self-Healing CI with Nx Cloud

In this section, we'll explore how Nx Cloud can help your pull request get to green faster with self-healing CI.

You can copy the example GitHub Action workflow file and place it in the `.github/workflows/ci.yml` directory of your repository. This workflow will run the `lint`, `test`, and `build` tasks for all projects in your repository whenever a pull request is opened or updated.

The `npx nx-cloud fix-ci` command that is already included in your GitHub Actions workflow (`github/workflows/ci.yml`) is responsible for enabling self-healing CI and will automatically suggest fixes to your failing tasks.

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=[33,34] %}
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
          filter: tree:0
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Set up JDK 21 for x64
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          architecture: x64
      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
      - run: npx nx run-many -t lint test build
      - run: npx nx-cloud fix-ci
        if: always()
```

You will also need to install the [Nx Console](/getting-started/editor-setup) editor extension for VS Code, Cursor, or IntelliJ. For the complete AI setup guide, see our [AI integration documentation](/getting-started/ai-integration).

{% install-nx-console /%}

### Open a Pull Request

Start by making a new branch to work on.

```shell {% path="~/gradle-tutorial" %}
git checkout -b self-healing-ci
```

Now for demo purposes, we'll make a mistake in our `DemoApplication` class that will cause the build to fail.

```diff {% fileName="application/src/main/java/com/example/multimodule/application/DemoApplication.java" %}
    @GetMapping("/")
    public String home() {
+       return myService.messages();
-       return myService.message();
    }
```

Commit the changes and open a new PR on GitHub.

```shell {% path="~/gradle-tutorial" %}
git add .
git commit -m 'demo self-healing ci'
git push origin self-healing-ci
```

Once pushed, CI will kick off, and we'll run into an error for the `application:build` task.
When the build task fails, you'll see Nx Cloud begin to analyze the failure and suggest a fix. When a fix is proposed, Nx Console will show a notification for you to review the potential fix. From here you can reject or apply the fix. Applying the fix will commit back to your PR and re-trigger CI to run.

You can also see the fix link on the GitHub PR comment that Nx Cloud leaves.

![Nx Cloud PR comment with AI fix suggestion](/shared/tutorials/nx-cloud-gh-comment-self-healing-coment.avif)

From here you can manually apply or reject the fix:

![Nx Cloud apply AI fix suggestion](/shared/tutorials/nx-cloud-apply-fix-self-healing-ci.avif)

For more information about how Nx can improve your CI pipeline, check out our [CI guides](/ci/recipes/set-up)

## Summary

Now that you have added Nx to this sample Gradle repository, you have learned several ways that Nx can help your
organization:

- Nx reflects the Gradle graph into the Nx graph
- Nx's dependency graph visualisation helps you understand your codebase
- Nx caches task results and reuses them when the same task is rerun later
- Nx Cloud provides self-healing CI and remote caching to speed up CI
- Nx [intelligently determines which tasks are `affected`](/ci/features/affected) by code changes to reduce waste in CI

## Next Steps

Connect with the rest of the Nx community with these resources:

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about
  Nx.
- [Follow Nx on Twitter](https://twitter.con/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
