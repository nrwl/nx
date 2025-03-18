# dev.nx.gradle

This gradle plugin contains

## Installation

Kotlin
build.gradle.kts

```
plugins {
    id("dev.nx.gradle") version("+")
}
```

Groovy
build.gradle

```
plugins {
    id "dev.nx.gradle" version "+"
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
