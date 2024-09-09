---
title: Overview of the Nx Gradle Plugin
description: The Nx Plugin for Gradle allows Gradle tasks to be run through Nx.
---

[Gradle](https://gradle.org/) is a fast, dependable, and adaptable open-source build automation tool with an elegant and extensible declarative build language. Gradle supports Android, Java, Kotlin Multiplatform, Groovy, Scala, Javascript, and C/C++.

The Nx Gradle plugin registers Gradle projects in your Nx workspace. It allows Gradle tasks to be run through Nx. Nx effortlessly makes your [CI faster](/ci/intro/ci-with-nx).

Nx adds the following features to your workspace:

- [Cache task results](/features/cache-task-results)
- [Distribute task execution](/ci/features/distribute-task-execution)
- [Run only tasks affected by a PR](/ci/features/affected)
- [Interactively explore your workspace](/features/explore-graph)

## Add Nx to a Gradle Workspace

In any Gradle workspace, run the following command to add Nx and select @nx/gradle:

```shell {% skipRescope=true %}
npx nx@latest init
```

Then, you can run Gradle tasks using Nx. For example:

{% tabs %}
{% tab label="Mac/Linux" %}

```shell {% skipRescope=true %}
./nx build <your gradle library>
```

{% /tab %}
{% tab label="Windows" %}

```shell {% skipRescope=true %}
nx.bat build <your gradle library>
```

{% /tab %}
{% /tabs %}

## Setting Up @nx/gradle in a Nx Workspace

In any Nx workspace, you can install `@nx/gradle` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/gradle
```

## How @nx/gradle Infers Tasks

The `@nx/gradle` plugin will create an Nx project for each Gradle configuration file present. Any of the following files will be recognized as a Gradle configuration file:

- `build.gradle`
- `build.gradle.kts`

### @nx/gradle Configuration

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
        "ciTargetName": "test-ci"
      }
    }
  ]
}
```

Once a Gradle configuration file has been identified, the targets are created with the name you specify under `testTargetName`, `classesTargetName` or `buildTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `test`, `classes` and `build`.

### Splitting E2E Tests

The `@nx/gradle` plugin will automatically split your e2e tasks by file if you provide a `ciTargetName`. You can read more about the Atomizer feature [here](/ci/features/split-e2e-tasks). This will create a target with that name which can be used in CI to run the tests for each file in a distributed fashion.

```json {% fileName="nx.json" highlightLines=[6] %}
{
  "plugins": [
    {
      "plugin": "@nx/gradle",
      "options": {
        "ciTargetName": "test-ci"
      }
    }
  ]
}
```

## View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/features/explore-graph#explore-projects-in-your-workspace) in Nx Console or run `nx show project my-project --web` in the command line.
