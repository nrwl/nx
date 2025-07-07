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
