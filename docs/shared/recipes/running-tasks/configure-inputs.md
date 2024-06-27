---
title: Configure Inputs for Task Caching
description: 'Learn how to optimize when Nx restores from the cache by customizing what should be taken into consideration when calculating computation hashes for tasks'
---

# Configure Inputs for Task Caching

When Nx [computes the hash for a given operation](/concepts/how-caching-works), it takes into account the `inputs` of the target.
The `inputs` are a list of **file sets**, **runtime** inputs and **environment variables** that affect the output of the target.
If any of the `inputs` change, the cache is invalidated and the target is re-run.

Nx errs on the side of caution when using inputs. Ideally, the "perfect" configuration of inputs will allow Nx to never re-run something when it does not need to. In practice though, it is better to play it safe and include more than strictly necessary in the inputs of a task. Forgetting to consider something during computation hash calculation may lead to negative consequences for end users. Start safe and fine-tune your inputs when there are clear opportunities to improve the cache hit rate.

For an overview of all the possible [types of inputs](/reference/inputs) and how to reuse sets of inputs as [named inputs](/reference/inputs#named-inputs), see the reference documentation.

Throughout this recipe, the following project structure of a simple workspace will be used as an example to help understand inputs better.

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
    }
  ],
  "dependencies": {
    "myreactapp": [
      { "source": "myreactapp", "target": "shared-ui", "type": "static" }
    ],
    "shared-ui": []
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

## View the Inputs of a Task

You can view the configuration for a task of a project by adding the `--graph` flag when running the command:

```shell
nx build myreactapp --graph
```

This will show the task graph executed by Nx when running the command.

Clicking the task will open a tooltip which lists out all of the inputs of the task. A button within the tooltip will also reveal more details about the configuration for the project which the task belongs to.

Doing so will show a view such as the one below:

{% project-details  jsonFile="shared/concepts/myreactapp.json"%}
{% /project-details %}

Nx Console has a button which will show a preview of this screen when a project level configuration file (`project.json` or `package.json`) is opened in the IDE. Read more at [Nx Console Project Details View](/recipes/nx-console/console-project-details).

Another way of accessing this information is to run `nx show project myreactapp --web` and the view above will be opened in a browser.

Use this tool to help understand what inputs are being used by Nx in your workspace.

{% callout title="Note" type="info" %}
If no `inputs` are specified at all, Nx will default to looking at all files of a project and its dependencies. This is a rather cautious approach. This might cause Nx to re-run a task in some cases where the cache could have been used instead but it will always give you correct output.
{% /callout %}

## Configure Inputs

The tasks you run in your workspace will likely already have `inputs` defined.
Be sure to [view the existing inputs](#viewing-the-inputs-of-a-task) and start from there.

Inputs of a task are configured in the `inputs` array on the target. This can be done in several different places:

- As of Nx 18, Nx Plugins often [infer inputs for tasks](/concepts/inferred-tasks) which run other tools.
  - In doing so, they will also define some reasonable defaults for the `inputs` of those tasks.
- The `inputs` array in the `targetDefaults` for a set of targets in `nx.json`.
- The `inputs` array for a specific target in the project configuration file.

{% callout title="Copy the existing inputs before modifying inputs for a task" %}
To override the `inputs` of a task, start by copying over the entire array shown when [viewing the project details](#viewing-the-inputs-of-a-task) and then add/modify/remove inputs as needed.
{% /callout %}

As you configure `inputs`, keep the project details screen open and it will refresh as changes are made. Check to make sure that the intended configuration is shown.

### Workspace Level Inputs

[Target Defaults](/reference/nx-json#target-defaults) defined in `nx.json` apply to a set of targets. Defining `inputs` here one time will apply to a set of similar targets.

```jsonc {% fileName="nx.json" highlightLines=[4] %}
{
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"]
    }
  }
}
```

The above specifies that all targets with the name `build` will use the `inputs` specified.
This configuration will override any `inputs` inferred by Nx Plugins as you have more direct control in your `nx.json` than the behavior of the Nx Plugin.
The configuration defined here completely overwrites any `inputs` inferred by Nx Plugins and is not merged in any way.
This configuration may be overridden by configuration in project-specific configuration files.

### Project Level Inputs

Defining `inputs` of a target in `project.json` or `package.json` will apply only to tasks of the specific project.

{% tabs %}
{% tab label="project.json" %}

```jsonc {% fileName="apps/myreactapp/project.json" highlightLines=[5] %}
{
  "name": "myreactapp",
  "targets": {
    "build": {
      "inputs": ["production", "^production"]
    }
  }
}
```

{% /tab %}
{% tab label="package.json" %}

```jsonc {% fileName="apps/myreactapp/package.json" highlightLines=[9] %}
{
  "name": "myreactapp",
  "dependencies": {},
  "devDependencies": {},
  ...
  "nx": {
    "targets": {
      "build": {
        "inputs": ["production", "^production"]
      }
      ...
    }
  }
}
```

{% /tab %}
{% /tabs %}

The above specifies that the `build` target of the `myreactapp` project will use the `inputs` specified.
This configuration will override any `inputs` inferred by Nx Plugins as well as any `inputs` defined in the [Target Defaults](/reference/nx-json#target-defaults) in the `nx.json` file as this is more specific than those other methods of configuring `inputs`.
The configuration defined here completely overwrites any `inputs` inferred by Nx Plugins or in target defaults and is not merged in any way.

## Common Inputs

### Test and Config Files

Often, projects include some files with runtime behavior and other files for unit testing. When running the `build` task, we do not want Nx to consider test files so updating the test files does not invalidate the cache for `build` tasks.

Plugins which define compile or bundling tasks such as `@nx/webpack/plugin` and `@nx/vite/plugin` will use the following inputs:

```jsonc
"inputs": [
  "production", // All files in a project including test files
  "^production" // Inputs of a dependencies which may affect behavior of projects which depend on them
]
```

Plugins which define testing tasks such as `@nx/cypress/plugin`, `@nx/playwright/plugin`, `@nx/jest/plugin` and `@nx/vite/plugin` will infer the following inputs for tasks:

```jsonc
"inputs": [
  "default", // All files in a project including test files
  "^production" // Inputs of a dependencies which may affect behavior of projects which depend on them
]
```

Given the above configurations, exclude the test and config files from the `production` named input:

```jsonc {% fileName="nx.json" highlightLines=["4-8"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/jest.config.ts",
      "!{projectRoot}/**/?(*.)+(spec|test).ts"
    ]
  }
}
```

With the above named inputs, Nx will behave in the following way:

- When only test files are changed, Nx will restore previous compilation results from the cache and re-run the tests for the projects containing the test files
- When any production files are changed, Nx will re-run the tests for the project as well as any projects which depend on it

### Consider the Version of a Language for all Tasks

Many times, the version of the programming language being used will affect the behavior of all tasks for the workspace.
A runtime input can be added to the `sharedGlobals` named input to consider it for the hash of every task.

For example, to consider the version of Node.js in the hash of every task, add `node --version` as an input.

```jsonc {% fileName="nx.json" highlightLines=["4"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "sharedGlobals": [{ "runtime": "node --version" }]
  }
}
```
