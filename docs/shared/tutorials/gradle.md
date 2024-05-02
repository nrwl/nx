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

Next, check out [the sample repository](https://github.com/nrwl/gradle-spring) on your local machine:

```shell
git clone https://github.com/nrwl/gradle-spring.git
```

This repository was created by following the [Spring framework](https://spring.io/)'s tutorial for [Creating a Multi-Module Project](https://spring.io/guides/gs/multi-module).

You can run the `./gradlew projects` command to get a list of projects in the repo.

```text {% command="./gradlew projects" %}
> Task :projects

------------------------------------------------------------
Root project 'gs-multi-module'
------------------------------------------------------------

Root project 'gs-multi-module'
+--- Project ':application'
\--- Project ':library'

To see a list of the tasks of a project, run gradlew <project-path>:tasks
For example, try running gradlew :application:tasks

BUILD SUCCESSFUL in 3s
1 actionable task: 1 executed
```

The repository has a simple library and an application that uses it.

You can build the `application` project by running `./gradlew application:build`:

```text {% command="./gradlew application:build" %}
BUILD SUCCESSFUL in 1s
9 actionable tasks: 9 up-to-date
```

## Add Nx

With the `@nx/gradle` plugin, Nx can be easily added to a Gradle repository and Nx will work seamlessly along side it.

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
├── application/
├── library/
├── build.gradle
├── gradlew
├── gradlew.bat
├── nx
├── nx.bat
├── nx.json
└── settings.gradle
```

Because this is not a javascript repository, there is no `package.json` file or `node_modules` folder. Instead, Nx has provided executables at the root of the repository: `nx` for Unix operating systems and `nx.bat` for Windows. These executables can be used in the same way that `gradlew` and `gradlew.bat` are used.

The `.nx` folder contains all the code needed to run the `nx` CLI and the cache that Nx uses.

The `nx.json` file contains repository-wide configuration options for Nx and a list of the currently installed Nx plugins.

## Explore Your Workspace

To get a visual representation of the dependencies between the projects in your repository, run the `./nx graph` command.

```shell {% path="~/gradle-tutorial" %}
./nx graph
```

{% graph title="Gradle Projects" height="200px" jsonFile="shared/tutorials/gradle-project-graph.json" %}
{% /graph %}

Nx uses this graph to determine the order tasks are run and enforce module boundaries. You can also leverage this graph to gain an accurate understanding of the architecture of your codebase. Notice that we did not change any of the Gradle configuration files or hard code any of these project definitions for Nx. Nx was able to directly read the Gradle configuration files, so this graph will always accurately represent the current state of the projects in your repository.

## Run Tasks

Nx can run any of your Gradle tasks. The Gradle command to run the `build` task for the `application` project is `./gradlew application:build`. The Nx command to run the same task is:

```shell
./nx build application
```

When Nx runs a Gradle task, it hands off the execution of that task to Gradle, so all task dependencies and configuration settings in the Gradle configuration are still respected.

To run all the `build` tasks in the repository with Gradle, run `./gradlew build`. To do the same thing with Nx, run:

```shell
./nx run-many -t build
```

Just like Gradle, Nx caches your tasks so that if you run the builds a second time without changing the source files, they'll complete almost instantly.

```{% command="./nx run-many -t build" %}

   ✔  nx run gs-multi-module:classes  [existing outputs match the cache, left as is]
   ✔  nx run library:classes  [existing outputs match the cache, left as is]
   ✔  nx run gs-multi-module:build  [existing outputs match the cache, left as is]
   ✔  nx run library:build  [existing outputs match the cache, left as is]
   ✔  nx run application:classes  [existing outputs match the cache, left as is]
   ✔  nx run application:build  [existing outputs match the cache, left as is]

—————————————————————————————————————————————————————————————————————————

 NX   Successfully ran target build for 3 projects and 3 tasks they depend on (74ms)

Nx read the output from the cache instead of running the command for 6 out of 6 tasks.
```

## Create a Custom Task

Nx can run any tasks that are available to Gradle - even your own custom tasks. Let's create a custom task to see this functionality in action. Edit the `application` gradle build file to create a custom task:

```{% fileName="application/build.gradle" highlightLines=["25-34"] %}
plugins {
	id 'org.springframework.boot' version '3.2.2'
	id 'io.spring.dependency-management' version '1.1.4'
	id 'java'
}

group = 'com.example'
version = '0.0.1-SNAPSHOT'

java {
	sourceCompatibility = '17'
}

repositories {
	mavenCentral()
}

dependencies {
	implementation 'org.springframework.boot:spring-boot-starter-actuator'
	implementation 'org.springframework.boot:spring-boot-starter-web'
	implementation project(':library')
	testImplementation 'org.springframework.boot:spring-boot-starter-test'
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
```

Now, you can run `mytask` with Nx like this:

```{% command="./nx mytask application" %}
> nx run application:mytask

> ../gradlew mytask


> Task :application:mytask
This is my task!

BUILD SUCCESSFUL in 358ms
1 actionable task: 1 executed
```

You can see all the tasks available to Nx by opening the project details view for the `application` project. You can do this either through [Nx Console](/getting-started/editor-setup) or from the terminal:

```shell {% path="~/gradle-tutorial" %}
./nx show project application --web
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/gradle-pdv.json" %}
{% /project-details %}

## Run Tasks for Affected Projects

Nx doesn't just cache your task results, it can also eliminate the need to run unnecessary tasks. Nx can use its project graph in conjunction with your git history to only run tasks for projects that may have been affected by the changes that you made. Let's explore how the [nx affected](/ci/features/affected) command works.

First, commit any outstanding changes in your repository:

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

Then you can use the `nx affected` command to run the `test` task only for projects that were affected by that change.

```shell
./nx affected -t test
```

The `test` task was run for the `application` project, but not for `library` because a change to the `application` project could not have changed the behavior of those projects. This feature is most useful in CI where you want to make sure to fully check every project that may have been affected by a change, but you want to avoid wasting time on tasks that do not need to be run. As more projects are added to the repository, this functionality becomes essential to maintain a fast CI pipeline.

## Summary

Now that you have added Nx to your Gradle repository, you can take advantage of Nx's dependency graph visualisation and leverage the `affected` command to speed up your CI pipeline. You can also more easily add javascript projects along side your Gradle projects and use Nx to manage them all.

## Setup CI for Your Gradle Repository

This tutorial walked you through how Nx can improve the developer experience for local development, but Nx can also make a big difference in CI. Without adequate tooling, CI times tend to grow exponentially with the size of the codebase. Nx helps reduce wasted time in CI with the [`affected` command](/ci/features/affected) and Nx Replay's [remote caching](/ci/features/remote-cache). Nx also [efficiently parallelizes tasks across machines](/ci/concepts/parallelization-distribution) with Nx Agents.

To set up Nx Replay run:

```shell
./nx connect
```

And click the link provided. You'll need to follow the instructions on the website to sign up for your account.

Then you can set up your CI by running the `@nx/gradle:ci-workflow` generator:

```shell
./nx generate @nx/gradle:ci-workflow --ci=github
```

This generator creates the following file:

```yml {% fileName=".github/workflows/ci.yml" highlightLines=[19] %}
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
      # Connect your workspace on nx.app and uncomment this to enable task distribution.
      # The "--stop-agents-after" is optional, but allows idle agents to shut down once the "build" targets have been requested
      # - run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-jvm" --stop-agents-after="build"
      - name: Set up JDK 17 for x64
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          architecture: x64
      - name: Setup Gradle
        uses: gradle/gradle-build-action@v2
      - uses: nrwl/nx-set-shas@v4
      - run: git branch --track main origin/main
        if: \${{ github.event_name == 'pull_request' }}
      - run: ./nx affected -t test build
```

This is a default CI configuration that sets up Nx Cloud to [use nx affected](/ci/features/affected). This will only run the tasks that are needed for a particular PR.

You can also [enable distributed task execution](/ci/features/distribute-task-execution) by uncommenting the `nx-cloud start-ci-run` line. This will automatically run all tasks on separate machines in parallel wherever possible, without requiring you to manually coordinate copying the output from one machine to another.

Check out one of these detailed tutorials on setting up CI with Nx:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Next Steps

Connect with the rest of the Nx community with these resources:

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
