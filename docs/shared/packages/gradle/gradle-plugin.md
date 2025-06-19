---
title: Overview of the Nx Gradle Plugin
description: The Nx Plugin for Gradle allows Gradle tasks to be run through Nx.
---

# @nx/gradle

[Gradle](https://gradle.org/) is a fast, dependable, and adaptable open-source build automation tool with an elegant and extensible declarative build language. Gradle supports Android, Java, Kotlin Multiplatform, Groovy, Scala, Javascript, and C/C++.

The Nx Gradle plugin registers Gradle projects in your Nx workspace. It allows Gradle tasks to be run through Nx. Nx effortlessly makes your [CI faster](/ci/intro/ci-with-nx).

Nx adds the following features to your workspace:

- [Cache task results](/features/cache-task-results)
- [Distribute task execution](/ci/features/distribute-task-execution)
- [Run only tasks affected by a PR](/ci/features/affected)
- [Interactively explore your workspace](/features/explore-graph)

{% callout type="info" title="Java Compatibility" %}
This plugin requires Java 17 or newer. Using older Java versions is unsupported and may lead to issues. If you need support for an older version, please create an issue on [Github](https://github.com/nrwl/nx)!
{% /callout %}

## Setup @nx/gradle

### Install Nx

You can install Nx globally. Depending on your package manager, use one of the following commands:

{% tabs %}
{% tab label="npm" %}

```shell
npm add --global nx@latest
```

{% /tab %}
{% tab label="Homebrew (macOS, Linux)" %}

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
{% /tabs %}

### Add Nx to a Gradle Workspace

In any Gradle workspace, run the following command to add Nx and the `@nx/gradle` plugin:

```shell {% skipRescope=true %}
nx init
```

Then, you can run Gradle tasks using Nx. For example:

```shell {% skipRescope=true %}
nx build <your gradle library>
```

## How @nx/gradle Infers Tasks

The `@nx/gradle` plugin relies on a companion Gradle plugin, `dev.nx.gradle.project-graph`, to analyze your Gradle build structure. When using `nx add`, the Gradle plugin is added as a dependency to the root Gradle build file. In most cases, the generator will add the task definition to trigger the plugin but if it's missing, add the following configuration to your Gradle configuration:

{% tabs %}
{% tab label="build.gradle.kts" %}

```kotlin {% fileName="build.gradle.kts" %}
plugins {
    id("dev.nx.gradle.project-graph") version("+")
}

allprojects {
    apply {
        plugin("dev.nx.gradle.project-graph")
    }
}
```

{% /tab %}
{% tab label="build.gradle" %}

```groovy {% skipRescope=true %}
plugins {
    id 'dev.nx.gradle.project-graph' version '+'
}

allprojects {
    apply plugin: 'dev.nx.gradle.project-graph'
}
```

{% /tab %}
{% /tabs %}

The `dev.nx.gradle.project-graph` plugin introduces a task named `nxProjectGraph`. This task analyzes your Gradle projects and their tasks, outputting the structure as JSON. The `@nx/gradle` plugin then uses this JSON data to accurately build the Nx project graph. If Nx has any issue generate the project graph JSON, you can run the `nxProjectGraph` task manually:

{% tabs %}
{% tab label="Mac OS/Linux" %}

```shell {% skipRescope=true %}
./gradlew nxProjectGraph
```

{% /tab %}
{% tab label="Windows" %}

```shell {% skipRescope=true %}
.\gradlew.bat nxProjectGraph
```

{% /tab %}
{% /tabs %}

## View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/features/explore-graph#explore-projects-in-your-workspace) in Nx Console or run `nx show project my-project` in the command line.

## Setting Up @nx/gradle in a Nx Workspace

In any Nx workspace, you can install `@nx/gradle` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/gradle
```

## @nx/gradle Configuration

The `@nx/gradle` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/gradle",
      "options": {
        "testTargetName": "test",
        "classesTargetName": "classes",
        "buildTargetName": "build",
        "ciTestTargetName": "test-ci"
      }
    }
  ]
}
```

Once a Gradle configuration file has been identified, the targets are created with the name you specify under `testTargetName`, `classesTargetName` or `buildTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `test`, `classes` and `build`.

### Splitting Tests

The `@nx/gradle` plugin will automatically split your testing tasks by test class if you provide a `ciTestTargetName`. You can read more about the Atomizer feature [here](/ci/features/split-e2e-tasks). Nx will create a task with the name that you specify which can be used in CI to run the tests for each test class in a distributed fashion.

```json {% fileName="nx.json" highlightLines=[6] %}
{
  "plugins": [
    {
      "plugin": "@nx/gradle",
      "options": {
        "ciTestTargetName": "test-ci"
      }
    }
  ]
}
```

### Continuous Tasks

Gradle doesn't have a standard way to identify tasks which are [continuous](/reference/project-configuration#continuous), like `bootRun` for serving a Spring Boot project. To ensure Nx handles these continuous tasks correctly, you can explicitly mark them as continuous.

{% tabs %}
{% tab label="nx.json" %}

In the `nx.json`, you can specify the target default configuration like so:

```json {% fileName="nx.json" highlightLines=[4] %}
{
  "targetDefaults": {
    "someTask": {
      "continuous": true
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

In a `project.json`, you can specify the target configuration like so:

```json {% fileName="project.json" highlightLines=[3] %}
{
  "someTask": {
    "continuous": true
  }
}
```

{% /tab %}
{% /tabs %}
