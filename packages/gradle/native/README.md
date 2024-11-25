# dev.nx.gradle.native

This gradle plugin contains

## Installation

Kotlin
build.gradle.kts

```
plugins {
    id("dev.nx.gradle.native") version("+")
}
```

Groovy
build.gradle

```
plugins {
    id "dev.nx.gradle.native" version "+"
}
```

## Usage

```bash
./gradlew :createNodes
```

In terminal, it should output something like:

```
> Task :createNodes
<your workspace>/.nx/cache/add-nx-to-gradle.json
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
