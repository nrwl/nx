---
title: Multi-Language Support
description: 'Nx works with any language or toolchain. Plugins infer projects, tasks, and dependencies from the configuration files your tools already use.'
sidebar:
  order: 10
filter: 'type:Features'
---

Nx works with any language or toolchain.
The task runner, caching, and [affected](/docs/features/ci-features/affected) commands all operate on the project graph.
Plugins build that graph by reading existing configuration files, so adding support for a new language or tool means teaching Nx to read those existing files.

## Basic configuration

Nx doesn't need a plugin to run tasks for another language.
Any directory with a [`project.json`](/docs/reference/project-configuration) file is an Nx project, and its targets run any command with the same caching and orchestration as a JS task:

{% tabs %}
{% tabitem label="Python + uv" %}

```jsonc
// packages/py-api/project.json
{
  "name": "py-api",
  "targets": {
    "test": {
      "command": "uv run pytest",
      "options": { "cwd": "packages/py-api" },
      "cache": true,
      "inputs": ["{projectRoot}/**/*.py", "{workspaceRoot}/uv.lock"],
    },
  },
}
```

{% /tabitem %}
{% tabitem label="Rust + Cargo" %}

```jsonc
// crates/rust-parser/project.json
{
  "name": "rust-parser",
  "targets": {
    "build": {
      "command": "cargo build --release",
      "options": { "cwd": "crates/rust-parser" },
      "cache": true,
      "inputs": ["{projectRoot}/src/**/*.rs", "{projectRoot}/Cargo.toml"],
      "outputs": ["{workspaceRoot}/target/release"],
    },
  },
}
```

{% /tabitem %}
{% tabitem label="Java + Gradle" %}

```jsonc
// apps/java-app/project.json
{
  "name": "java-app",
  "targets": {
    "test": {
      "command": "./gradlew :java-app:test",
      "cache": true,
      "inputs": ["{projectRoot}/src/**/*.java", "{projectRoot}/build.gradle"],
      "outputs": ["{projectRoot}/build/test-results"],
    },
  },
}
```

{% /tabitem %}
{% tabitem label=".NET" %}

```jsonc
// apps/dotnet-app/project.json
{
  "name": "dotnet-app",
  "targets": {
    "test": {
      "command": "dotnet test",
      "options": { "cwd": "apps/dotnet-app" },
      "cache": true,
      "inputs": ["{projectRoot}/**/*.cs", "{projectRoot}/DotnetApp.csproj"],
    },
  },
}
```

{% /tabitem %}
{% /tabs %}

## Automatically configure projects and tasks

Plugins remove the need to write that configuration by hand.
A language plugin declares which files mark a project, usually the toolchain's manifest: `pyproject.toml` for Python, `go.mod` for Go, `Cargo.toml` for Rust, `build.gradle` for Gradle.
For every match, the plugin creates a project and its tasks, with caching, inputs, and outputs configured once in the plugin instead of per project.
This is the same [inferred tasks](/docs/concepts/mental-model#inferred-tasks) mechanism the JavaScript plugins use to read `vite.config.ts` or `jest.config.ts`.

Enabling a language plugin is one entry in `nx.json`:

```jsonc
// nx.json
{
  "plugins": ["@nx/gradle", "@nx/dotnet"],
}
```

With these plugins enabled, the `java-app` and `dotnet-app` projects above no longer need a `project.json`.
Their tasks are inferred from `build.gradle` and the `.csproj` file.

From there, Nx runs each toolchain's own commands, and cache hits restore outputs no matter what language produced them:

```shell {% meta="prompt=true" %}
$ nx test py-api
> nx run py-api:test
12 passed in 1.2s
$ nx build rust-parser
> nx run rust-parser:build
Finished `release` profile [optimized] target(s) in 4.1s
$ nx test java-app
> nx run java-app:test
BUILD SUCCESSFUL in 6s
$ nx test dotnet-app
> nx run dotnet-app:test
Passed! - Failed: 0, Passed: 24, Total: 24
```

Run `nx show project <project-name>` to see everything a plugin inferred for a project.

## Dependencies come from your toolchain

Plugins also tell Nx how projects relate by reading the dependency information your toolchain already wrote down:

{% tabs %}
{% tabitem label="Python + uv" %}

```toml {% meta="{4,6-7}" %}
# packages/py-api/pyproject.toml
[project]
name = "py-api"
dependencies = ["shared-utils"]

[tool.uv.sources]
shared-utils = { workspace = true }
```

{% /tabitem %}
{% tabitem label="Rust + Cargo" %}

```toml {% meta="{5-6}" %}
# crates/rust-parser/Cargo.toml
[package]
name = "rust-parser"

[dependencies]
shared-utils = { path = "../shared-utils" }
```

{% /tabitem %}
{% tabitem label="Java + Gradle" %}

```groovy {% meta="{3}" %}
// apps/java-app/build.gradle
dependencies {
    implementation project(':shared-utils')
}
```

{% /tabitem %}
{% tabitem label=".NET" %}

```xml {% meta="{4}" %}
<!-- apps/dotnet-app/DotnetApp.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="../../libs/shared-utils/SharedUtils.csproj" />
  </ItemGroup>
</Project>
```

{% /tabitem %}
{% /tabs %}

Manifests aren't the only source.
The built-in JavaScript and TypeScript support parses source files and creates dependencies from `import` statements, in addition to `package.json` dependencies, and a plugin can do the same for its own language.

These edges are what make `nx affected`, task ordering, and the [graph visualization](/docs/features/explore-graph) accurate across languages, and they connect cross-language boundaries too, such as a deploy task that depends on both a JS frontend and a Java backend.

## Use an existing plugin

Check what already covers your toolchain before writing a plugin:

- [Gradle](/docs/technologies/java/gradle/introduction)
- [Maven](/docs/technologies/java/maven/introduction)
- [.NET](/docs/technologies/dotnet/introduction)
- [@nxlv/python](https://github.com/lucasvieirasilva/nx-plugins/tree/main/packages/nx-python) (Community)
- [@nx-go/nx-go](https://github.com/nx-go/nx-go) (Community)
- [@monodon/rust](https://github.com/cammisuli/monodon/tree/main/packages/rust) (Community)

Browse the [plugin registry](/docs/plugin-registry) for the full list.

## Build your own plugin

If your toolchain isn't covered, you can add your own support with a plugin.
Follow [add language support to Nx](/docs/kb/add-language-support) for a complete walkthrough that uses Python with uv and adapts to any toolchain.
