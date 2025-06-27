---
title: 'Run Tasks'
description: 'Learn how to use Nx task runner to efficiently manage and execute tasks across multiple projects in your monorepo, including parallel execution and caching.'
---

# Tasks

{% youtube src="https://youtu.be/aEdfYiA5U34" title="Run tasks with Nx" /%}

In a monorepo setup, you don't just run tasks for a single project; you might have hundreds to manage. To help with this, Nx provides a powerful task runner that allows you to:

- easily **run multiple targets** for multiple projects **in parallel**
- define **task pipelines** to run tasks in the correct order
- only run tasks for **projects affected by a given change**
- **speed up task execution** with [caching](/features/cache-task-results)

## Define Tasks

Nx tasks can be created from existing `package.json` scripts, [inferred from tooling configuration files](/concepts/inferred-tasks), or defined in a `project.json` file. Nx combines these three sources to determine the tasks for a particular project.

{% tabs %}
{% tab label="package.json" %}

```json
{
  "name": "mylib",
  "scripts": {
    "build": "tsc -p tsconfig.lib.json",
    "test": "jest"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json
{
  "root": "libs/mylib",
  "targets": {
    "build": {
      "command": "tsc -p tsconfig.lib.json"
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        /* ... */
      }
    }
  }
}
```

{% /tab %}
{% tab label="Inferred by Nx Plugins" %}

[Nx plugins](/concepts/nx-plugins) can detect your tooling configuration files (e.g. `vite.config.ts` or `.eslintrc.json`) and automatically configure runnable tasks including [Nx cache](/features/cache-task-results). For example, the `@nx/jest` plugin will automatically create a `test` task for a project that uses Jest. The names can be configured in the `nx.json` file:

```json
{
  ...
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "previewTargetName": "preview",
        "serveStaticTargetName": "serve-static"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "options": {
        "targetName": "test"
      }
    }
  ],
  ...
}
```

Learn more about [inferred tasks here](/concepts/inferred-tasks).

{% /tab %}
{% /tabs %}

The [project configuration docs](/reference/project-configuration) has the details for all the available configuration options.

## Run Tasks

Nx uses the following syntax:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

{% callout type="note" title="Terminal UI" %}

In Nx 21, task output is displayed in an [interactive terminal UI](/recipes/running-tasks/terminal-ui) that allows you to actively choose which task output to display, search through the list of tasks and display multiple tasks side by side.

{% /callout %}

### Run a Single Task

To run the `test` task for the `header` project run this command:

```shell
npx nx test header
```

### Run Tasks for Multiple Projects

You can use the `run-many` command to run a task for multiple projects. Here are a couple of examples.

Run the `build` task for all projects in the repo:

```shell
npx nx run-many -t build
```

Run the `build`, `lint` and `test` task for all projects in the repo:

```shell
npx nx run-many -t build lint test
```

Run the `build`, `lint`, and `test` tasks only on the `header` and `footer` projects:

```shell
npx nx run-many -t build lint test -p header footer
```

Nx parallelizes these tasks, ensuring they **run in the correct order based on their dependencies** and [task pipeline configuration](/concepts/task-pipeline-configuration). You can also [control how many tasks run in parallel at once](/recipes/running-tasks/run-tasks-in-parallel).

Learn more about the [run-many](/reference/core-api/nx/documents/run-many) command.

### Run Tasks on Projects Affected by a PR

You can also run a command for all the projects affected by your PR like this:

```shell
npx nx affected -t test
```

Learn more about the affected command [here](/ci/features/affected).

## Defining a Task Pipeline

It is pretty common to have dependencies between tasks, requiring one task to be run before another. For example, you might want to run the `build` target on the `header` project before running the `build` target on the `app` project.

Nx can automatically detect the dependencies between projects (see [project graph](/features/explore-graph)).

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "myreactapp",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "feat-products",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "myreactapp": [
      { "source": "myreactapp", "target": "feat-products", "type": "static" }
    ],
    "shared-ui": [],
    "feat-products": [
      {
        "source": "feat-products",
        "target": "shared-ui",
        "type": "static"
      }
    ]
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

However, you need to specify for which targets this ordering is important. In the following example we are telling Nx that before running the `build` target it needs to run the `build` target on all the projects the current project depends on:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

This means that if we run `nx build myreactapp`, Nx will first execute `build` on `shared-ui` and `feat-products` before running `build` on `myreactapp`.

You can define these task dependencies globally for your workspace in `nx.json` or individually in each project's `project.json` file.

Learn more about:

- [What a task pipeline is all about](/concepts/task-pipeline-configuration)
- [How to configure a task pipeline](/recipes/running-tasks/defining-task-pipeline)

## Reduce repetitive configuration

Learn more about leveraging `targetDefaults` to reduce repetitive configuration in the [dedicated recipe](/recipes/running-tasks/reduce-repetitive-configuration).

## Run Root-Level Tasks

Sometimes, you need tasks that apply to the entire codebase rather than a single project. To still benefit from caching, you can run these tasks through the "Nx pipeline". Define them in the root-level `package.json` or `project.json` as follows:

{% tabs %}
{% tab label="package.json" %}

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  },
  "nx": {}
}
```

> Note the `nx: {}` property on the `package.json`. This is necessary to inform Nx about this root-level project. The property can also be expanded to specify cache inputs and outputs.

If you want Nx to cache the task, but prefer to use npm (or pnpm/yarn) to run the script (i.e. `npm run docs`) you can use the [nx exec](/reference/core-api/nx/documents/exec) command:

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "nx exec -- node ./generateDocsSite.js"
  },
  "nx": {}
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="project.json"%}
{
  "name": "myorg",
  ...
  "targets": {
    "docs": {
      "command": "node ./generateDocsSite.js"
    }
  }
}
```

{% /tab %}
{% /tabs %}

To invoke the task, use:

```shell
npx nx docs
```

Learn more about root-level tasks on [our dedicated recipe page](/recipes/running-tasks/root-level-scripts).
