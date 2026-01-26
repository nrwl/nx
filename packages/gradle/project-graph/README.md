# dev.nx.gradle.project-graph

This gradle plugin contains

## Installation

Kotlin
build.gradle.kts

```
plugins {
    id("dev.nx.gradle.project-graph") version("+")
}
```

Groovy
build.gradle

```
plugins {
    id "dev.nx.gradle.project-graph" version "+"
}
```

## Usage

```bash
./gradlew nxProjectGraph
```

In terminal, it should output something like:

```
> Task :nxProjectGraph
< your workspace >/build/nx/add-nx-to-gradle.json
```

To pass in a hash parameter:

```bash
./gradlew nxProjectGraph -Phash=12345
```

To control whether Nx generates individual targets for each Gradle task (atomized targets) or a single target for the entire Gradle project, set the `atomized` boolean in your `build.gradle` or `build.gradle.kts` file.

To disable atomized targets:

```
nxProjectReport {
  atomized = false
}

```

It generates a json file to be consumed by nx:

```json
{
  "nodes": {
    "app": {
      "targets": {}
    }
  },
  "dependencies": [],
  "externalNodes": {}
}
```

## Configuration

The plugin provides a type-safe `nx {}` DSL for configuring Nx-specific metadata on your Gradle projects and tasks.

### Project-Level Configuration

Configure project metadata such as name, tags, and custom properties:

**Kotlin (build.gradle.kts):**

```kotlin
import dev.nx.gradle.nx

nx {
  set("name", "my-custom-name")
  array("tags", "api", "backend")
}
```

**Groovy (build.gradle):**

```groovy
import static dev.nx.gradle.Groovy.nx

nx(project) {
  it.set 'name', 'my-custom-name'
  it.array 'tags', 'api', 'backend'
}
```

### Task-Level Configuration

Configure Nx target-specific behavior on individual tasks:

**Kotlin (build.gradle.kts):**

```kotlin
import dev.nx.gradle.nx

tasks.named("integrationTest") {
  nx {
    set("cache", true)
  }
}
```

**Groovy (build.gradle):**

```groovy
import static dev.nx.gradle.Groovy.nx

tasks.named('integrationTest') {
  nx(it) {
    it.set 'cache', true
  }
}
```

For complete documentation on the Gradle DSL including all available options and examples, see the [Gradle plugin configuration guide](https://nx.dev/packages/gradle/documents/overview#configuring-projects-and-tasks-with-the-gradle-dsl).
