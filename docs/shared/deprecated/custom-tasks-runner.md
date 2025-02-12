# Deprecating Custom Tasks Runner

The Nx core has been migrated to Rust. However, the Custom Tasks Runner API is not compatible with this rewrite because it allows modifications to the lifecycle of the Nx command execution, which could break important invariants that Nx depends on.

The custom task runners API was created many years ago and has not been supported for several years. It was developed before we introduced a formal method for extending Nx through plugins. The new API leverages the plugins API for better performance and functionality.

## The preTasksExecution and postTasksExecution hooks

### Custom Tasks Runner Version

Let’s imagine that you have implemented a custom task runner as follows:

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

### New API

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

You can no longer augment options passed in to the default tasks runner, so instead you need to set env variables in the `preTasksExecution` hook.

### Composing Plugins

Implementing hooks in plugins offers several advantages. It allows multiple plugins to be loaded simultaneously, enabling a clean separation of concerns.

### Keeping State Across Command Invocations

By default, every plugin initiates a long-running process, allowing you to maintain state across command invocations, which can be very useful for advanced analytics.

## Self-Hosted Remote Cache

The `preTasksExecution` and `postTasksExecution` hooks cannot modify the execution of tasks, making it impossible to use them for implementing a remote cache. Instead, you should [install and activate one of the Nx Powerpack packages](/nx-enterprise/activate-powerpack). Nx Powerpack does not make requests to external APIs, nor does it collect or send any data. **Additionally, it offers more security and prevents cache poisoning, unlike DIY solutions.**

We recognize that many organizations have been using DIY remote cache solutions. Therefore, we have made the migration to Nx Powerpack as streamlined as possible.

{% call-to-action title="Get a License and Activate Powerpack" icon="nx" description="Unlock all the features of the Nx CLI" url="/nx-enterprise/activate-powerpack" /%}

### Example Configuration Change

Enabling a Nx Powerpack plugin will configure it in `nx.json`. The specific modification depends on your repository’s configuration. The following is one example, where a custom tasks runner configuration in `nx.json` will be removed:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nx-aws-plugin/nx-aws-cache",
      "options": {
        "awsAccessKeyId": "key",
        "awsSecretAccessKey": "secret",
        "awsForcePathStyle": true,
        "awsEndpoint": "http://custom",
        "awsBucket": "my-bucket",
        "awsRegion": "eu-central-1",
        "encryptionFileKey": "key"
      }
    }
  }
}
```

And replaced with:

```json
{
  "s3": {
    "accessKeyId": "key",
    "secretAccessKey": "secret",
    "forcePathStyle": true,
    "endpoint": "http://custom",
    "bucket": "my-bucket",
    "region": "eu-central-1",
    "encryptionFileKey": "key",
    "localMode": "read-write"
  }
}
```

The API documentation for each plugin describes the available options.

## Unhandled Custom Tasks Runner Use Cases?

If you have a use case that the new API doesn't handle, please [open an issue](http://github.com/nrwl/nx).
