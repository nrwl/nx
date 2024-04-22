---
title: 'Gradle Tutorial'
description: In this tutorial you'll add Nx to an existing Gradle repo
---

# Gradle Tutorial

In this tutorial, you'll learn how to add Nx to a repository with an existing Gradle setup. You'll see how Nx can provide immediate value with very little configuration and then you can gradually enable more features.

<!-- - Add Nx to the repository with a single command
- Configure caching for your existing tasks
- Configure a task pipeline
- Use Nx Plugins to automatically configure caching -->

<!-- ## Final Source Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/gradle-tutorial/tree/final" /%} -->

## Get Started

Make sure that you have [Gradle](https://gradle.org/) installed on your system. Consult [Gradle's installation guide](https://docs.gradle.org/current/userguide/installation.html) for instruction that are specific to your operating system.

To verify that Gradle was installed correctly, run this command:

```shell
gradle --version
```

Next, create a `gradle-tutorial` folder to hold the repository.

```shell
mkdir gradle-tutorial
cd gradle-tutorial
```

Then, run the `gradle init` command to generate a default repository:

```{% command="gradle init --type java-application --dsl kotlin" %}
Enter target Java version (min: 7, default: 21): 21

Project name (default: gradle-tutorial): gradle-tutorial

Select application structure:
  1: Single application project
  2: Application and library project
Enter selection (default: Single application project) [1..2] 2

Generate build using new APIs and behavior (some features may change in the next minor release)? (default: no) [yes, no] no


> Task :init
To learn more about Gradle by exploring our Samples at https://docs.gradle.org/8.7/samples/sample_building_java_applications_multi_project.html

BUILD SUCCESSFUL in 23s
1 actionable task: 1 executed
```

Finally, set up git and create your first commit:

```shell
git init
git commit -am "initial commit"
```

You can run the `gradle projects` command to get a list of projects in the repo.

```text {% command="gradle projects" %}
> Task :projects

------------------------------------------------------------
Root project 'gradle-tutorial'
------------------------------------------------------------

Root project 'gradle-tutorial'
+--- Project ':app'
+--- Project ':list'
\--- Project ':utilities'

To see a list of the tasks of a project, run gradle <project-path>:tasks
For example, try running gradle :app:tasks

BUILD SUCCESSFUL in 15s
11 actionable tasks: 11 executed
```

The repository has two Java libraries (under `list` and `utilities`) that are used in an application located in the `app` folder.

You can build the `app` project by running `gradle app:build`:

```text {% command="gradle app:build" %}
BUILD SUCCESSFUL in 3s
21 actionable tasks: 12 executed, 9 up-to-date
```

## Add Nx

With the `@nx/gradle` plugin, Nx can be easily added to a Gradle repository and Nx will work seamlessly along side Gradle.

Nx offers many features, but at its core, it is a task runner. Out of the box, it can cache your tasks and ensure those tasks are run in the correct order. After the initial set up, you can incrementally add on other features that would be helpful in your organization.

To enable Nx in your repository, run a single command:

```shell {% path="~/gradle-tutorial" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it.

The script will propose installing the `@nx/gradle` plugin to allow Nx to understand Gradle configuration files. Make sure to select the plugin to install it.

After Nx has been installed, there will be a few new files in your repository:

```treeview
gradle-tutorial/
├── .nx/
├── app/
├── list/
├── utilities/
├── gradlew
├── gradlew.bat
├── nx
├── nx.bat
├── nx.json
└── settings.gradle.kts
```

Because this is not a javascript repository, there is no `package.json` file or `node_modules` folder. Instead, Nx has provided executables at the root of the repository: `nx` for Unix operating systems and `nx.bat` for Windows. These executables can be used in the same way that `gradlew` and `gradlew.bat` are used.

The `.nx` folder contains all the code needed to run the `nx` CLI and the cache that Nx uses.

The `nx.json` file contains repository-wide configuration options for Nx and contains a list of the currently installed Nx plugins.

## Explore Your Workspace

To get a visual representation of the dependencies between the projects in your repository, run the `./nx graph` command.

```shell {% path="~/gradle-tutorial" %}
./nx graph
```

{% graph title="Gradle Projects" height="200px" jsonFile="shared/tutorials/gradle-project-graph.json" %}
{% /graph %}

Nx uses this graph to determine the order tasks are run and enforce module boundaries. You can also leverage this graph to gain an accurate understanding of the architecture of your codebase. Notice that we did not change any of the Gradle configuration files or hard code any of these project definitions for Nx. Nx was able to directly read the Gradle configuration files, so this graph will always accurately represent the current state of the projects in your repository.

## Run Tasks

Nx can run any of your Gradle tasks. The Gradle command to run the `build` task for the `app` project is `./gradlew app:build`. The Nx command to run the same task is:

```shell
./nx build app
```

When Nx runs a Gradle task, it hands off the execution of that task to Gradle, so all task dependencies and configuration settings in the Gradle configuration are still respected.

To run all the `build` tasks in the repository with Gradle, run `./gradlew build`. To do the same thing with Nx, run:

```shell
./nx run-many -t build
```

## Create a Custom Task

Nx can run any tasks that are available to Gradle - even your own custom tasks. Let's create a custom task to see this functionality in action. Edit the `app` gradle build file to create a custom task:

```kts {% fileName="app/build.gradle.kts" %}
/*
 * This file was generated by the Gradle 'init' task.
 */

plugins {
    id("buildlogic.java-application-conventions")
}

dependencies {
    implementation("org.apache.commons:commons-text")
    implementation(project(":utilities"))
}

tasks.register("mytask"){
    group = "Custom"
    description = "A custom task"
}

tasks.named("mytask"){
    doFirst {
        println("This is my task!")
    }
}

application {
    // Define the main class for the application.
    mainClass = "org.example.app.App"
}
```

Now, you can run `mytask` with Nx like this:

```{% command="./nx mytask app" %}
> nx run app:mytask

> /Users/isaac/Documents/code/gradle/gradlew mytask


> Task :app:mytask
This is my task!

BUILD SUCCESSFUL in 522ms
11 actionable tasks: 2 executed, 9 up-to-date
```

You can see all the tasks available to Nx by opening the project details view for the `app` project. You can do this either through [Nx Console](/getting-started/editor-setup) or from the terminal:

```shell {% path="~/tuskydesigns" %}
npx nx show project @tuskdesign/demo --web
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/gradle-pdv.json" %}
{% /project-details %}

## Run Tasks for Affected Projects

Nx doesn't just cache your task results, it can also eliminate the need to run unnecessary tasks. Nx can use its project graph in conjunction with your git history to only run tasks for projects that may have been affected by the changes that you made. Let's explore how the [nx affected](/ci/features/affected) command works.

First, commit any outstanding changes in your repository:

```shell
git commit -am "changes"
```

Next make a small change to the `app` code:

```java {% fileName="app/src/main/java/org/example/app/App.java" %}
/*
 * This source file was generated by the Gradle 'init' task
 */
package org.example.app;

import org.example.list.LinkedList;

import static org.example.utilities.StringUtils.join;
import static org.example.utilities.StringUtils.split;
import static org.example.app.MessageUtils.getMessage;

import org.apache.commons.text.WordUtils;

public class App {
    public static void main(String[] args) {
        LinkedList tokens;
        tokens = split(getMessage());
        String result = join(tokens) + " something";
        System.out.println(WordUtils.capitalize(result));
    }
}
```

Then you can use the `nx affected` command to run the `assemble` task only for projects that were affected by that change.

```shell
./nx affected -t assemble
```

The assemble task was run for the `app` project, but not for `list` or `utilities` because a change to the `app` project could not have changed the behavior of those projects. This feature is most useful in CI where you want to make sure to fully check every project that may have been affected by a change, but you want to avoid wasting time on tasks that do not need to be run. As more projects are added to the repository, this functionality becomes essential to maintain a fast CI pipeline.

## Summary

Now that you have added Nx to your Gradle repository, you can take advantage of Nx's dependency graph visualisation and leverage the `affected` command to speed up your CI pipeline. You can also more easily add javascript projects along side your Gradle projects and use Nx to manage them all.

## Setup CI for Your NPM Workspace

This tutorial walked you through how Nx can improve the developer experience for local development, but Nx can also make a big difference in CI. Without adequate tooling, CI times tend to grow exponentially with the size of the codebase. Nx helps reduce wasted time in CI with the [`affected` command](/ci/features/affected) and Nx Replay's [remote caching](/ci/features/remote-cache). Nx also [efficiently parallelizes tasks across machines](/ci/concepts/parallelization-distribution) with Nx Agents.

To set up Nx Replay run:

```shell
nx connect
```

And click the link provided. You'll need to follow the instructions on the website to sign up for your account.

Then you can set up your CI by creating the following file:

```yml {% fileName=".github/workflows/ci.yml" %}
name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout project sources
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup Gradle
        uses: gradle/gradle-build-action@v2

      - uses: nrwl/nx-set-shas@v3

      # This line is needed for nx affected to work when CI is running on a PR
      - run: git branch --track main origin/main
        if: ${{ github.event_name == 'pull_request' }}

      - name: Run build with Gradle Wrapper
        run: ./nx affected -t test build --parallel=3
```

This is a default CI configuration that sets up Nx Cloud to [use nx affected](/ci/features/affected). This will only run the tasks that are needed for a particular PR.

Check out one of these detailed tutorials on setting up CI with Nx:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Next Steps

Connect with the rest of the Nx community with these resources:

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
