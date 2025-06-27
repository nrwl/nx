---
title: 'Deprecating Custom Tasks Runner'
description: 'Learn about the transition from Custom Tasks Runner to the new plugin-based API in Nx, including pre and post task execution hooks and self-hosted remote cache options.'
---

# Deprecating Custom Tasks Runner

The Custom Task Runners API was created many years ago and has not been supported for several years. It was developed before we introduced a formal method for extending Nx through [plugins](/extending-nx/intro/getting-started). The API potentially allows modifications to the lifecycle of the Nx command execution, which breaks important invariants that Nx depends on. The new API leverages the plugins API for better performance and functionality.

This page guides you on how to migrate off the now deprecated Custom Task Runner API for both:

- choosing the best remote cache option for your organization
- implementing pre/post processing logic when running tasks

## Remote Cache

There are several ways to set up remote caching with Nx.
[Read more about remote cache options](/recipes/running-tasks/self-hosted-caching).

## The preTasksExecution and postTasksExecution hooks

Starting with Nx 20.4, a dedicated plugin-based API has been introduced that allows you to safely hook into the task running lifecycle. This new approach provides pre and post execution hooks without compromising Nx's internal operations. For comprehensive documentation on this feature, see [Hook into the Task Running Lifecycle](/extending-nx/recipes/task-running-lifecycle).

Let's look into some concrete examples of how you can migrate from the previous custom task runners to this new API.

### Before: Custom Tasks Runner Version

Let's imagine that you have implemented a custom task runner as follows:

```typescript
function serializeTasksResults(taskResults: { [taskId: string]: TaskResult }) {
  // ...
}

function validateEnv() {
  // ...
}

export default async function customTasksRunner(tasks, options, context) {
  if (process.env.QA_ENV) {
    process.env.NX_SKIP_NX_CACHE = 'true';
  }
  if (!validateEnv()) {
    throw new Error('Env is not set up correctly');
  }
  const allTaskResults = {};
  const lifeCycle = {
    endTasks(taskResults) {
      taskResults.forEach((tr) => {
        allTaskResults[tr.task.id] = tr;
      });
    },
  };
  const ret = await defaultTasksRunner(
    tasks,
    { ...options, lifeCycle },
    context
  );
  if (options.reportAnalytics) {
    await fetch(process.env.DATACAT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: serializeTasksResults(allTaskResults),
    });
  }
  return ret;
}
```

And let's imagine you configured it in `nx.json` as follows:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "npm-package-with-custom-tasks-runner",
      "options": {
        "reportAnalytics": true
      }
    }
  }
}
```

### After: Using the New API

The new API includes `preTasksExecution` and `postTasksExecution` hooks that plugins can register. These hooks do not affect task execution and cannot violate any invariants.

The custom task runner above can be implemented as follows:

```typescript
function serializeTasksResults(taskResults: { [taskId: string]: TaskResult }) {
  // task results contain timings and status information useful for gathering analytics
}

function validateEnv() {
  // ...
}

// context contains workspaceRoot and nx.json configuration
export async function preTasksExecution(options: any, context) {
  if (process.env.QA_ENV) {
    process.env.NX_SKIP_NX_CACHE = 'true';
  }
  if (!validateEnv()) {
    throw new Error('Env is not set up correctly');
  }
}

// context contains workspaceRoot, nx.json configuration, and task results
export async function postTasksExecution(options: any, context) {
  if (options.reportAnalytics) {
    await fetch(process.env.DATACAT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: serializeTasksResults(context.taskResults),
    });
  }
}
```

Because it's a regular plugin, it can be configured as follows in `nx.json`:

```json
{
  "plugins": [
    {
      "plugin": "npm-package-with-the-plugin",
      "options": {
        "reportAnalytics": true
      }
    }
  ]
}
```

As with all plugin hooks, the `preTasksExecution` and `postTasksExecution` hooks must be exported so that they load properly when the "npm-package-with-the-plugin" is initialized.

### Multiple Tasks Runners

You can implement multiple tasks runners using the new hooks.

Imagine you have the following `nx.json`:

```json
{
  "tasksRunnerOptions": {
    "a": {
      "runner": "package-a"
    },
    "b": {
      "runner": "package-b"
    }
  }
}
```

You can replace it with two plugins:

```json
{
  "plugins": [
    {
      "plugin": "package-a"
    },
    {
      "plugin": "package-b"
    }
  ]
}
```

Simply add a condition to your hooks as follows:

```typescript
export async function preTasksExecution() {
  if (process.env.RUNNER != 'a') return;
}

export async function postTasksExecution(options, tasksResults) {
  if (process.env.RUNNER != 'a') return;
}
```

You can then choose which hooks to use by setting the RUNNER env variable.

### Passing Options

You can no longer augment options passed to the default tasks runner, so instead you need to set env variables in the `preTasksExecution` hook.

### Composing Plugins

Implementing hooks in plugins offers several advantages. It allows multiple plugins to be loaded simultaneously, enabling a clean separation of concerns.

### Keeping State Across Command Invocations

By default, every plugin initiates a long-running process, allowing you to maintain state across command invocations, which can be very useful for advanced analytics.

## Unhandled Custom Tasks Runner Use Cases?

If you have a use case that the new API doesn't handle, please [open an issue](http://github.com/nrwl/nx).
