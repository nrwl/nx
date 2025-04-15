---
title: Hook into the Task Running Lifecycle
description: Learn how to extend Nx's task running process with preTasksExecution and postTasksExecution hooks to implement custom logic before and after tasks run.
---

# Hook into the Task Running Lifecycle

Nx plugins can hook into the task running lifecycle to execute custom logic before and after tasks are run. This is useful for implementing custom analytics, environment validation, or any other pre/post processing that should happen when running tasks.

{% callout type="note" title="New API for deprecated custom task runners" %}
These task execution hooks are the new API that replaces the deprecated Custom Tasks Runners. This feature is available since Nx 20.4+. For information about migrating from Custom Tasks Runners to these hooks, see [Deprecating Custom Tasks Runner](/deprecated/custom-tasks-runner).
{% /callout %}

## Task Execution Hooks

Nx provides two hooks that plugins can register:

1. `preTasksExecution`: Runs before any tasks are executed
2. `postTasksExecution`: Runs after all tasks are executed

These hooks allow you to extend Nx's functionality without affecting task execution or violating any invariants.

## Creating Task Execution Hooks

To implement task execution hooks, create a plugin and export the `preTasksExecution` and/or `postTasksExecution` functions:

```typescript
// Example plugin with both pre and post execution hooks

// context contains workspaceRoot and nx.json configuration
export async function preTasksExecution(options: any, context) {
  // Run custom logic before tasks are executed
  console.log('About to run tasks!');

  // You can modify environment variables
  if (process.env.QA_ENV) {
    process.env.NX_SKIP_NX_CACHE = 'true';
  }

  // You can validate the environment
  if (!isEnvironmentValid()) {
    throw new Error('Environment is not set up correctly');
  }
}

// context contains workspaceRoot, nx.json configuration, and task results
export async function postTasksExecution(options: any, context) {
  // Run custom logic after tasks are executed
  console.log('All tasks have completed!');

  // You can access task results for analytics
  if (options.reportAnalytics) {
    await fetch(process.env.ANALYTICS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(context.taskResults),
    });
  }
}

function isEnvironmentValid() {
  // Implement your validation logic
  return true;
}
```

## Configuring Your Plugin

Configure your plugin in `nx.json` by adding it to the `plugins` array:

```json
{
  "plugins": [
    {
      "plugin": "my-nx-plugin",
      "options": {
        "reportAnalytics": true
      }
    }
  ]
}
```

The options you specify in the configuration will be passed to your hook functions.

## Maintaining State Across Command Invocations

By default, every plugin initiates a long-running process, allowing you to maintain state across command invocations. This is particularly useful for gathering advanced analytics or providing cumulative feedback.

## Conditional Execution

You can implement conditional logic in your hooks to control when they run:

```typescript
export async function preTasksExecution(options, context) {
  // Only run for specific environments
  if (process.env.RUNNER !== 'production') return;

  // Your pre-execution logic
}

export async function postTasksExecution(options, context) {
  // Only run for specific task types
  const hasAngularTasks = Object.keys(context.taskResults).some((taskId) =>
    taskId.includes('angular')
  );

  if (!hasAngularTasks) return;

  // Your post-execution logic
}
```

## Best Practices

1. **Keep hooks fast**: Hooks should execute quickly to avoid slowing down the task execution process
2. **Handle errors gracefully**: Ensure your hooks don't crash the entire execution pipeline
3. **Use environment variables** for configuration that needs to persist across tasks
4. **Leverage context data**: Use the context object to access relevant information about the workspace and task results
5. **Provide clear errors**: If throwing errors, make sure they are descriptive and actionable
