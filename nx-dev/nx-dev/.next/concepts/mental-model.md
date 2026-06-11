---
title: Mental Model
description: Understand how Nx works with project graphs, task graphs, affected commands, and caching to efficiently manage your monorepo development workflow.
sidebar:
  order: 1
filter: 'type:Concepts'
---

Nx is a VSCode of build tools, with a powerful core, driven by metadata, and extensible through [plugins](/docs/concepts/nx-plugins). Nx works with a few core concepts to drive your monorepo efficiently: project graphs, task graphs, affected commands, computation hashing, and caching.

## The project graph

A project graph is used to reflect the source code in your repository and all the external dependencies that aren't
authored in your repository, such as Webpack, React, Angular, and so forth.

![project-graph](../../../assets/concepts/mental-model/project-graph.svg)

Nx analyzes your file system to detect projects. Projects are identified by the presence of a `package.json` file or `project.json` file. Projects identification can also be customized through plugins. You can manually define dependencies between
the project nodes, but you don't have to do it very often. Nx analyzes files' source code, your installed dependencies, TypeScript
files, and others figuring out these dependencies for you. Nx also stores the cached project graph, so it only
reanalyzes the files you have changed.

![project-graph-updated](../../../assets/concepts/mental-model/project-graph-updated.svg)

Nx provides an updated graph after each analysis is done.

## Metadata-driven

Everything in Nx comes with metadata to enable toolability. Nx gathers information about your projects and tasks and then uses that information to help you understand and interact with your codebase. With the right plugins installed, most of the metadata can be [inferred directly from your existing configuration files](/docs/concepts/inferred-tasks) so you don't have to define it manually.

This metadata is used by Nx itself, by VSCode and WebStorm integrations, by GitHub integration, and by third-party
tools.

![metadata](../../../assets/concepts/mental-model/metadata.png)

These tools are able to implement richer experiences with Nx using this metadata.

## The task graph

Nx uses the project graph to create a task graph. Any time you run anything, Nx creates a task graph from the project
graph and then executes the tasks in that graph.

For instance `nx test lib` creates a task graph with a single node:

{% graph height="100px" type="task" %}

```json
{
  "projects": [
    {
      "name": "lib",
      "type": "lib",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    }
  ],
  "taskIds": ["lib:test"],
  "taskGraph": {
    "roots": ["lib:test"],
    "tasks": {
      "lib:test": {
        "id": "lib:test",
        "target": {
          "project": "lib",
          "target": "test"
        },
        "projectRoot": "libs/lib",
        "overrides": {}
      }
    },
    "dependencies": {}
  }
}
```

{% /graph %}

A task is an invocation of a target. If you invoke the same target twice, you create two tasks.

Nx uses the [project graph](#the-project-graph), but the task graph and project graph aren't isomorphic, meaning they
aren't directly connected. In the case above, `app1` and `app2` depend on `lib`, but
running `nx run-many -t test -p app1 app2 lib`, the created task graph will look like this:

**Project Graph:**

{% graph height="200px" type="project" %}

```json
{
  "projects": [
    {
      "name": "lib",
      "type": "lib",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    }
  ],
  "taskIds": ["lib:test"],
  "taskGraph": {
    "roots": ["lib:test"],
    "tasks": {
      "lib:test": {
        "id": "lib:test",
        "target": {
          "project": "lib",
          "target": "test"
        },
        "projectRoot": "libs/lib",
        "overrides": {}
      }
    },
    "dependencies": {}
  }
}
```

{% /graph %}

**Task Graph:**

{% graph height="200px" type="task"%}

```json
{
  "projects": [
    {
      "name": "lib",
      "type": "lib",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    }
  ],
  "taskIds": ["lib:test"],
  "taskGraph": {
    "roots": ["lib:test"],
    "tasks": {
      "lib:test": {
        "id": "lib:test",
        "target": {
          "project": "lib",
          "target": "test"
        },
        "projectRoot": "libs/lib",
        "overrides": {}
      }
    },
    "dependencies": {}
  }
}
```

{% /graph %}

Even though the apps depend on `lib`, testing `app1` doesn't depend on the testing `lib`. This means that the two tasks
can
run in parallel.

Let's look at the test target relying on its dependencies.

```json
{
  "test": {
    "executor": "@nx/jest:jest",
    "outputs": ["{workspaceRoot}/coverage/apps/app1"],
    "dependsOn": ["^test"],
    "options": {
      "jestConfig": "apps/app1/jest.config.js",
      "passWithNoTests": true
    }
  }
}
```

With this, running the same test command creates the following task graph:

**Project Graph:**

{% graph height="200px" type="project" %}

```json
{
  "projects": [
    {
      "name": "lib",
      "type": "lib",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    }
  ],
  "taskIds": ["lib:test"],
  "taskGraph": {
    "roots": ["lib:test"],
    "tasks": {
      "lib:test": {
        "id": "lib:test",
        "target": {
          "project": "lib",
          "target": "test"
        },
        "projectRoot": "libs/lib",
        "overrides": {}
      }
    },
    "dependencies": {}
  }
}
```

{% /graph %}

**Task Graph:**

{% graph height="200px" type="task" %}

```json
{
  "projects": [
    {
      "name": "lib",
      "type": "lib",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    }
  ],
  "taskIds": ["lib:test"],
  "taskGraph": {
    "roots": ["lib:test"],
    "tasks": {
      "lib:test": {
        "id": "lib:test",
        "target": {
          "project": "lib",
          "target": "test"
        },
        "projectRoot": "libs/lib",
        "overrides": {}
      }
    },
    "dependencies": {}
  }
}
```

{% /graph %}

This often makes more sense for builds, where to build `app1`, you want to build `lib` first. You can also define
similar
relationships between targets of the same project, including a test target that depends on the build. Learn more about configuring task pipelines in [Task Pipeline Configuration](/docs/concepts/task-pipeline-configuration).

A task graph can contain different targets, and those can run in parallel. For instance, as Nx is building `app2`, it
can be testing `app1` at the same time.

![task-graph-execution](../../../assets/concepts/mental-model/task-graph-execution.svg)

Nx also runs the tasks in the task graph in the right order. Nx executing tasks in parallel speeds up your overall
execution time.

## Affected commands

When you run `nx test app1`, you are telling Nx to run the `app1:test` task plus all the tasks it depends on.

When you run `nx run-many -t test -p app1 lib`, you are telling Nx to do the same for two
tasks `app1:test`
and `lib:test`.

When you run `nx run-many -t test`, you are telling Nx to do this for all the projects.

As your workspace grows, retesting all projects becomes too slow. To address this Nx implements code change analysis via the [`affected` command](/docs/features/ci-features/affected) to
get the min set of projects that need to be retested. How does it work?

When you run `nx affected -t test`, Nx looks at the files you changed in your PR, it will look at the nature of
change (what exactly did you update in those files), and it uses this to figure the list of projects in the workspace
that can be affected by this change. It then runs the `run-many` command with that list.

For instance, if my PR changes `lib`, and I then run `nx affected -t test`, Nx figures out that `app1` and `app2`
depend on `lib`, so it will invoke `nx run-many -t test -p app1 app2 lib`.

![affected](../../../assets/concepts/mental-model/affected.svg)

Nx analyzes the nature of the changes. For example, if you change the version of Next.js in the package.json, Nx knows
that `app2` cannot be affected by it, so it only retests `app1`.

## Computation hashing and caching

Before running a task, Nx computes a hash based on source files, configuration, dependencies, and other inputs. If the hash matches a previous run, the cached result is replayed — including terminal output and file artifacts. If not, Nx runs the task and stores the result for next time.

![computation-hashing](../../../assets/concepts/mental-model/computation-hashing.svg)

Nx checks the local cache first, then the [remote cache](/docs/features/ci-features/remote-cache) if configured. From the user's point of view, the command ran the same, only a lot faster.

![cache](../../../assets/concepts/mental-model/cache.svg)

See [How Caching Works](/docs/concepts/how-caching-works) for the complete list of hash inputs, cache configuration options, and optimization details.

## Distributed task execution

For large workspaces, even with caching, running all tasks on a single machine can be slow. [Nx Agents](/docs/features/ci-features/distribute-task-execution) can distribute the task graph across multiple machines, running tasks in parallel while using [remote caching](/docs/features/ci-features/remote-cache) to share artifacts between agents. From your CI's perspective, the results appear as if everything ran on a single machine.

![Distribution](../../../assets/concepts/mental-model/dte.svg)

## In summary

- Nx is able to analyze your source code to create a Project Graph.
- Nx can use the project graph and information about projects' targets to create a Task Graph.
- Nx is able to perform code-change analysis to create the smallest task graph for your PR.
- Nx supports [computation caching](/docs/features/cache-task-results) to never execute the same computation twice. This computation cache is pluggable and
  can be distributed.
