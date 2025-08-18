# @nx/maven

An Nx plugin for integrating Maven projects into Nx workspaces.

## Overview

This plugin enables you to:
- Generate new Maven projects with Nx integration
- Run Maven commands through Nx executors
- Leverage Nx's caching and task scheduling for Maven builds
- Manage Maven projects alongside other Nx-supported technologies

## Installation

```bash
npm install @nx/maven
```

## Generators

### `@nx/maven:init`

Initialize Maven support in an Nx workspace.

```bash
nx g @nx/maven:init
```

### `@nx/maven:project`

Generate a new Maven project.

```bash
nx g @nx/maven:project my-app --groupId=com.example --artifactId=my-app
```

Options:
- `--name`: Project name
- `--directory`: Directory where the project is placed
- `--groupId`: Maven group ID
- `--artifactId`: Maven artifact ID
- `--version`: Project version (default: 1.0-SNAPSHOT)
- `--packaging`: Maven packaging type (jar, war, pom)

## Executors

### `@nx/maven:compile`

Compile a Maven project.

```bash
nx compile my-app
```

### `@nx/maven:test`

Run tests for a Maven project.

```bash
nx test my-app
```

Options:
- `--testNamePattern`: Run tests matching this pattern

### `@nx/maven:package`

Package a Maven project.

```bash
nx package my-app
```

Options:
- `--skipTests`: Skip running tests during packaging

## Configuration

Each Maven project will have a `project.json` file with the following structure:

```json
{
  "name": "my-app",
  "root": "apps/my-app",
  "projectType": "application",
  "sourceRoot": "apps/my-app/src/main/java",
  "targets": {
    "compile": {
      "executor": "@nx/maven:compile"
    },
    "test": {
      "executor": "@nx/maven:test"
    },
    "package": {
      "executor": "@nx/maven:package"
    }
  }
}
```

## Integration with Nx

The plugin leverages Nx's capabilities:

- **Caching**: Maven build outputs are cached for faster subsequent builds
- **Task Scheduling**: Maven tasks respect dependency graphs
- **Parallelization**: Multiple Maven projects can be built in parallel
- **Affected**: Only affected projects are rebuilt when files change

## Requirements

- Maven 3.6+ installed and available in PATH
- Java 17+ (configurable in pom.xml)
- Nx workspace