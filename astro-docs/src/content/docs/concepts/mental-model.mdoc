---
title: Mental Model
description: Understand how project graphs, inferred tasks, task graphs, affected commands, and caching work together in Nx.
sidebar:
  order: 1
filter: 'type:Concepts'
---

Nx coordinates work in your workspace through a few core concepts: the project graph, inferred tasks, the task graph, affected commands, and computation caching.
[Plugins](/docs/concepts/nx-plugins) apply these concepts to the tools and frameworks in your repository.

## The project graph

The project graph represents the source code in your repository and external dependencies such as Vite, React, and Angular.

![A project graph with applications and libraries](../../../assets/concepts/mental-model/project-graph.svg)

Nx analyzes your file system to detect projects. It identifies projects from a `project.json` file or a `package.json` file included in your package manager's workspaces configuration. Plugins can also customize how Nx identifies projects. You can manually define dependencies between
the project nodes, but you don't have to do it very often. Nx analyzes source code, your installed dependencies, and TypeScript
configuration to figure out these dependencies for you. Nx also stores the cached project graph, so it only
reanalyzes the files you have changed.

Nx caches the project graph and recomputes the parts affected by file changes.
The updated graph reflects the current state of your workspace.

## Inferred tasks

Every project has tasks you can run, such as `build`, `test`, or `lint`. Tasks can come from three places:

- Nx can use a script in the project's `package.json`.
- Nx can use a target defined in the project's `project.json`.
- A plugin can infer a task from tool configuration.

Your tools already describe how they run.
A `vite.config.ts` file defines where the build output goes.
Rather than asking you to repeat that information, Nx plugins read the tool configuration and create tasks for you.
The `@nx/vite` plugin, for example, detects `vite.config.ts` files and infers tasks such as `build`, `dev`, and `preview` with the correct command, cache settings, [inputs](/docs/kb/configure-inputs), [outputs](/docs/kb/configure-outputs), and task dependencies.

To see every task Nx detected for a project, and where each setting came from, show the project details:

```shell
nx show project my-project
```

When a plugin infers settings you want to change, override them.
Nx merges task configuration from three sources, with later sources winning:

1. Task configuration inferred by plugins registered in `nx.json`.
2. `targetDefaults` in `nx.json`.
3. The project's own configuration in `package.json` or `project.json`.

For all configuration options, see [project configuration](/docs/reference/project-configuration).
To move an older workspace onto inferred tasks, follow the [Migrate to Inferred Tasks](/docs/kb/convert-to-inferred) guide.

## The task graph

Nx creates a task graph whenever you run tasks.
Each node is a task, which is a specific target invoked for a project, such as `myapp:build`.
Edges represent the dependencies between tasks.
For example, `nx test lib` creates a task graph with one node:

{% graph title="Task graph for nx test lib" height="160px" type="task" %}

```json
{
  "projects": [
    {
      "name": "lib",
      "type": "lib",
      "data": {
        "root": "libs/lib",
        "projectType": "library",
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
        "outputs": [],
        "projectRoot": "libs/lib",
        "overrides": {},
        "cache": true,
        "parallelism": true,
        "continuous": false
      }
    },
    "dependencies": {
      "lib:test": []
    },
    "continuousDependencies": {
      "lib:test": []
    }
  }
}
```

{% /graph %}

The project graph and task graph aren't identical.
In this project graph, both applications depend on `lib`:

Nx uses the [project graph](#the-project-graph) to figure out which tasks exist, but the task graph isn't a mirror of the
project graph. In the case below, `app1` and `app2` depend on `lib`:

{% graph height="200px" type="project" %}

```json
{
  "projects": [
    {
      "name": "app1",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "app2",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "app1",
      "type": "app",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "app1": [{ "source": "app1", "target": "lib", "type": "static" }],
    "app2": [{ "source": "app2", "target": "lib", "type": "static" }],
    "lib": []
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

Running `nx run-many -t test -p app1 app2 lib` creates a task graph with three disconnected nodes:

![Tasks running in dependency order and in parallel](../../../assets/concepts/mental-model/task-graph-execution.svg)

{% graph height="200px" type="task" %}

```json
{
  "projects": [
    {
      "name": "app1",
      "type": "app",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    },
    {
      "name": "app2",
      "type": "app",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    },
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
  "taskIds": ["app1:test", "app2:test", "lib:test"],
  "taskGraph": {
    "roots": ["app1:test", "app2:test", "lib:test"],
    "tasks": {
      "app1:test": {
        "id": "app1:test",
        "target": {
          "project": "app1",
          "target": "test"
        },
        "projectRoot": "apps/app1",
        "overrides": {}
      },
      "app2:test": {
        "id": "app2:test",
        "target": {
          "project": "app2",
          "target": "test"
        },
        "projectRoot": "apps/app2",
        "overrides": {}
      },
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
    "dependencies": {
      "app1:test": [],
      "app2:test": [],
      "lib:test": []
    }
  }
}
```

{% /graph %}

Even though the apps depend on `lib`, testing `app1` doesn't depend on testing `lib`. This means that the three tasks
can run in parallel.

Now let's make the test target depend on the test tasks of its dependencies:

```json title="nx.json"
{
  "targetDefaults": {
    "test": {
      "dependsOn": ["^test"]
    }
  }
}
```

With this, running the same test command creates the following task graph:

{% graph height="200px" type="task" %}

```json
{
  "projects": [
    {
      "name": "app1",
      "type": "app",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    },
    {
      "name": "app2",
      "type": "app",
      "data": {
        "tags": [],
        "targets": {
          "test": {}
        }
      }
    },
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
  "taskIds": ["app1:test", "app2:test", "lib:test"],
  "taskGraph": {
    "roots": ["lib:test"],
    "tasks": {
      "app1:test": {
        "id": "app1:test",
        "target": {
          "project": "app1",
          "target": "test"
        },
        "projectRoot": "apps/app1",
        "overrides": {}
      },
      "app2:test": {
        "id": "app2:test",
        "target": {
          "project": "app2",
          "target": "test"
        },
        "projectRoot": "apps/app2",
        "overrides": {}
      },
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
    "dependencies": {
      "app1:test": ["lib:test"],
      "app2:test": ["lib:test"],
      "lib:test": []
    }
  }
}
```

{% /graph %}

This often makes more sense for builds, where to build `app1`, you want to build `lib` first. You can also define
similar relationships between targets of the same project, including a test target that depends on the build. Learn more about configuring task pipelines in [Task Pipeline Configuration](/docs/concepts/task-pipeline-configuration).

A task graph can contain different targets that run in parallel. For instance, while Nx builds `app2`, it can test `app1` at the same time.

![task-graph-execution](../../../assets/concepts/mental-model/task-graph-execution.svg)

Nx also runs the tasks in the task graph in the right order. Nx executing tasks in parallel speeds up your overall
execution time.

## Affected commands

Running `nx test app1` creates the `app1:test` task and any tasks it depends on.
Running `nx run-many -t test -p app1 lib` creates tasks for both projects.
Without a project filter, `nx run-many -t test` creates a test task for every project with that target.

Use `nx affected -t test` to limit the task graph to projects affected by your changes.
Nx maps changed files to projects, applies plugin-specific change analysis, and follows the project
graph to include dependent projects.
It then runs the requested target for that set.

For example, if a change affects `lib`, and both `app1` and `app2` depend on it, the affected project
set contains all three projects.

![Affected projects after a library change](../../../assets/concepts/mental-model/affected.svg)

When you run `nx affected -t test`, Nx identifies the files changed in your PR and follows their project dependencies and imports to determine which projects the change can affect. It then runs the `run-many` command with that list.

For instance, when a PR changes `lib`, Nx detects that `app1` and `app2` depend on `lib`, then invokes `nx run-many -t test -p app1 app2 lib`.

![affected](../../../assets/concepts/mental-model/affected.svg)

Nx analyzes the nature of the changes. For example, if you change the version of Next.js in the package.json, Nx knows
that `app2` cannot be affected by it, so it only retests `app1`.

## Computation hashing and caching

Before running a task, Nx computes a hash based on source files, configuration, dependencies, and other inputs. If the hash matches a previous run, Nx replays the cached result, including terminal output and file artifacts. If not, Nx runs the task and stores the result for next time.

![Inputs used to calculate a task hash](../../../assets/concepts/mental-model/computation-hashing.svg)

Nx checks the local cache first and then checks the
[remote cache](/docs/features/ci-features/remote-cache) when one is configured.
A cache hit has the same result as executing the task, but avoids the computation.

![Nx checking local and remote caches](../../../assets/concepts/mental-model/cache.svg)

For the complete hashing and cache model, see [how caching works](/docs/concepts/how-caching-works).

## Distributed task execution

For large workspaces, even with caching, running all tasks on a single machine can be slow. [Nx Agents](/docs/features/ci-features/distribute-task-execution) distribute the task graph across multiple machines, running tasks in parallel while using remote caching to share artifacts between agents. CI receives the results as though everything ran on a single machine.

![Distribution](../../../assets/concepts/mental-model/dte.svg)

## How it fits together

- Nx analyzes your source code to create a project graph.
- Nx plugins infer tasks from your tool configuration, so most task settings don't have to be written by hand.
- Nx uses the project graph and task configuration to create a task graph and run tasks in the right order.
- Code-change analysis creates the smallest task graph for your PR.
- [Computation caching](/docs/features/cache-task-results) makes sure the same computation never runs twice. You can plug in a cache provider and distribute cached results.
