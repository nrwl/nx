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
        "ciTestTargetName": "test-ci",
        "ciIntTestTargetName": "intTest-ci"
      }
    }
  ]
}
```

Once a Gradle configuration file has been identified, the targets are created with the name you specify under `testTargetName`, `classesTargetName` or `buildTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `test`, `classes` and `build`.

### Test Distribution

Nx provides powerful features for distributing tasks in CI, including test splitting (also known as atomization) and optimized build targets. For Gradle projects, this is facilitated by the `@nx/gradle` plugin, allowing you to run your tests and builds more efficiently in your Continuous Integration (CI) environment.

#### How to Set Up Test Distribution (Atomizer) in CI

To enable test distribution for your Gradle projects in CI, follow these steps:

1.  **Generate CI Workflow**: Run the `ci-workflow` generator to set up the necessary CI configurations. This generator creates a GitHub Actions workflow file that integrates with Nx's distributed task execution capabilities.

    ```shell
    nx g @nx/gradle:ci-workflow
    ```

    This command will generate a workflow file (e.g., `.github/workflows/ci.yml`) tailored for your Nx workspace with Gradle projects.

2.  **Configure `nx.json` for Atomizer**: Add or ensure the presence of `ciTestTargetName` or `ciIntTestTargetName` in the `@nx/gradle` plugin options within your `nx.json`.

    ```json {% fileName="nx.json" highlightLines=[6,7] %}
    {
      "plugins": [
        {
          "plugin": "@nx/gradle",
          "options": {
            "ciTestTargetName": "test-ci",
            "ciIntTestTargetName": "intTest-ci"
          }
        }
      ]
    }
    ```

    Setting these options turns on the atomizer feature in CI. Nx will automatically split your testing tasks (unit and integration tests, respectively) by test class, allowing them to be run in a distributed fashion across your CI agents.

3.  **Update CI Workflow Command**: In your generated CI workflow file, modify the command used to run affected tasks. Instead of using a generic `build` target, leverage the `build-ci` target provided by the `@nx/gradle` plugin:

    ```shell
    # Before:
    # ./nx affected --base=$NX_BASE --head=$NX_HEAD -t build

    # After:
    ./nx affected --base=$NX_BASE --head=$NX_HEAD -t build-ci
    ```

    This ensures that your CI pipeline utilizes the optimized `build-ci` target, which is designed to integrate seamlessly with Nx's test distribution and caching mechanisms.

#### The `ci-workflow` Generator

The `@nx/gradle:ci-workflow` generator is a utility that automates the setup of a CI workflow for your Nx workspace containing Gradle projects. It creates a `.github/workflows` file (or equivalent for other CI providers) that includes steps for checking out code, setting up Java and Gradle, restoring caches, and running affected Nx tasks. Its primary purpose is to streamline the integration of Nx's CI features, such as distributed task execution and caching, into your existing CI pipeline.

#### The `build-ci` Target

The `@nx/gradle` plugin can create a `build-ci` target that is specifically designed for use in CI environments. This target allows for a more optimized and consistent build process by ensuring that the `check` task is rewired to its CI counterpart (`check-ci`), which also implies that test tasks (`test` and `intTest`) are rewired to their atomized `test-ci` and `intTest-ci` counterparts respectively.

##### What is it?

The `build-ci` target is a synthetic Nx target that acts as a placeholder for your Gradle `build` task in a CI context. Instead of directly running the `build` task, the `build-ci` target ensures that the `check` task (a dependency of `build`) first executes its CI-optimized version (`check-ci`), which in turn uses the split/atomized test tasks (`test-ci`, `intTest-ci`). This allows for distributed execution of tests and efficient caching in CI.

##### How to Enable?

To enable the `build-ci` target, you need to configure `ciTestTargetName` or `ciIntTestTargetName` in the `@nx/gradle` plugin options in your `nx.json`.

For example:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/gradle",
      "options": {
        "ciTestTargetName": "test-ci",
        "ciBuildTargetName": "build-ci"
      }
    }
  ]
}
```

When `ciTestTargetName` (or `ciIntTestTargetName`) is set, the `build-ci` target is automatically created if the `build` task exists for a given Gradle project.

##### Expected Behavior

When you run `nx build-ci <your-gradle-project>`, Nx will:

1.  Execute the `check-ci` task (if defined) instead of the standard `check` task.
2.  The `check-ci` task will, in turn, trigger the atomized test tasks (`test-ci` and `intTest-ci`) if they are configured.
3.  The `build-ci` target itself will use the `nx:noop` executor, meaning it doesn't execute a direct Gradle command, but rather relies on its dependencies (`check-ci`) to orchestrate the build process in a CI-friendly manner.
4.  The `build-ci` target is cacheable.

This setup ensures that your build process in CI leverages Nx's caching and distribution capabilities effectively.

##### How to Turn it Off?

To disable the `build-ci` target, simply remove the `ciBuildTargetName` option from the `@nx/gradle` plugin configuration in your `nx.json` file. If `ciTestTargetName` and `ciIntTestTargetName` are also removed, then the special CI targets for tests and check will also be turned off.

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
