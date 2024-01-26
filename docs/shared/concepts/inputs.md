---
title: Fine-tuning Caching with Inputs
description: 'Learn how to optimize when Nx restores from the cache by customizing what should be taken into consideration when calculating computation hashes for tasks'
---

# Fine-tuning Caching with Inputs

When Nx [computes the hash for a given operation](/concepts/how-caching-works), it takes into account the `inputs` of the target.
The `inputs` are a list of **file sets**, **runtime** inputs and **environment variables** that affect the output of the target.
If any of the `inputs` change, the cache is invalidated and the target is re-run.

Throughout this recipe, you will see that Nx errs on the side of caution when using inputs. Ideally, the "perfect" configuration of inputs will allow Nx to never re-run something when it does not need to. In practice though, it is better to play it safe and include more than strictly necessary in the inputs of a task. Forgetting to consider something during computation hash calculation may lead to consequences for end users. Start safe and fine-tune your inputs when there are clear opportunities to improve cache hit rate.

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

## Types of Inputs

Nx can consider the following types of Inputs when computing the hash for a given operation.

### Project Configuration

The configuration of a project includes the definition of the task itself. Changing this will often result in a change of behavior of running different tasks.

Nx always considers the configuration of the project of a task and its dependencies when calculating the hash of a task.

### Command Arguments

Passing different arguments to a Nx command will often change the behavior of a task. Nx will filter out arguments which are for Nx itself and do not have any effect on running of tasks such as `--parallel` or `--projects`. Nx will always take into consideration command arguments when calculating the hash for a task.

For example, running `nx build myreactapp --prod` will not reuse the cached output of running `nx build myreactapp`.

### Source Files

Changing source code will often change the behavior of a task. Nx can consider the contents of files matching a pattern when calculating the computation hash.
Source File inputs are defined like this:

```jsonc
"inputs": {
  "{projectRoot}/**/*", // All files in a project
  "{workspaceRoot}/.gitignore", // A specific file in the workspace
  "{projectRoot}/**/*.ts", // A glob pattern for files
  "!{projectRoot}/**/*.spec.ts", // Excluding files matching a glob pattern
}
```

Source File inputs must be prefixed with either `{projectRoot}` or `{workspaceRoot}` to distinguish where the paths should be resolved from.

Prefixing a Source File input with `!` will exclude the files matching the pattern from the set of files used to calculate the hash.

By default, Nx will use all files in a project as well as all files in the project's dependencies when computing a hash for tasks belonging to the project.
This may cause Nx to rerun some tasks even when files irrelevant to the task have changed but it ensures that by default, Nx always re-runs the task when it should.

See the [Common Input Sets section](#common-inputs) to see some common examples of source file inputs

### Environment Variables

Tools and scripts will often use some Environment Variables to change their behavior. Nx can consider the value of environment variables when calculating the computation hash in order to invalidate the cache if the environment variable value changes. Environment Variable inputs are defined like this:

```jsonc
"inputs": [
  { "env": "API_KEY" } // this will include the value of $API_KEY in the cache hash
]
```

### Runtime Inputs

You can use a Runtime input to provide a script which will output the information you want to include in the computation hash. Runtime inputs are defined like this:

```jsonc
"inputs": [
  { "runtime": "node --version" }
]
```

This kind of input is often used to include versions of tools used to run the task. You should ensure that these scripts work on any platform where the workspace is used. Avoid using `.sh`/`.bat` files as these will not work across Windows and \*nix operating systems.

### External Dependencies

Source code often imports from external dependencies installed through package managers. For example, a React application will likely import `react`. It is not needed to configure those `externalDependencies` directly. Nx will always consider External Dependencies depended upon by any source code within the project.

External Dependencies are also often tools used to run tasks. Updating the versions of those tools will change the behavior of those tasks. External Dependencies inputs are defined like this:

```jsonc
"inputs": [
  { "externalDependencies": ["jest"] }
]
```

By default, if no external dependencies inputs are specified, Nx will include the hash of all external dependencies of the workspace in the computation hash.
For many targets, Nx does not know which external dependencies are used and which are not.
By considering all external dependencies, Nx will always re-run tasks when necessary even though in some cases, it might have been able to restore from cache.

For example, when defining a target to run `eslint .`, Nx does not know which ESLint Plugins are used by the eslint config.
To be safe, it will consider all external dependencies, including all ESLint plugins, to ensure that the `lint` task is re-run when any of the plugins have been updated.
The drawback of this assumption is that Nx will re-run the `lint` task even when external dependencies not used by ESLint are updated.

```jsonc
"targets": {
  "lint": {
    "command": "eslint ."
  }
}
```

This default behavior can be overridden by adding any external dependency inputs and enables Nx to use cached results more often.

```jsonc {% highlightLines=[6] %}
"targets": {
  "lint": {
    "command": "eslint .",
    "inputs": [
      "default",
      { "externalDependencies": ["eslint", "eslint-config-airbnb"] }
    ]
  }
}
```

Targets which use an Executor from a Nx Plugin maintained by the Nx Team will have the correct set of external dependencies considered when calculating the hash.

### Outputs of Dependent Tasks

When a task depends on another task, it is possible that the outputs of the dependent task will affect the behavior of the task. Nx can consider the contents of files produced by dependent tasks matching a pattern when calculating the computation hash. Outputs of Dependent Tasks as inputs are defined like this:

```jsonc
"inputs": [
  { "dependentTasksOutputFiles": "**/*.d.ts" },
  { "dependentTasksOutputFiles": "**/*.d.ts", "transitive": true }
]
```

The pattern will be matched with outputs of tasks which this task depends on. Setting `transitive` to `true` will also include outputs of all task dependencies of this task in the [task pipeline](/concepts/task-pipeline-configuration).

### A subset of the root `tsconfig.json` or `tsconfig.base.json`

When a root `tsconfig.json` or `tsconfig.base.json` is present, Nx will always consider parts of the file which apply to the project of a task being run.
This includes the full `compilerOptions` section and particular path mappings in the `compilerOptions.paths` property.
This allows Nx to to not invalidate every single task when a path mapping is added or removed from the root `tsconfig.json` file

## Named Inputs

Many tasks will utilize the same sets of inputs with minor differences. Nx allows you to define these sets in the `namedInputs` section of the `nx.json` file.

These sets of inputs can then be referenced and reused in the `inputs` array of targets. You can think of these as variables which can be used in the `inputs` array.

Named Inputs can be defined for the entire workspace in `nx.json` or for a specific project in `project.json`/`package.json`.

{% tabs %}
{% tab label="Workspace (nx.json)" %}

Named inputs defined in `nx.json` can be used by any project in the workspace in the `inputs` array. The following example shows how to define named inputs for the entire workspace in `nx.json`.

```jsonc {% fileName="nx.json" highlightLines=["2-4"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"] // Default Inputs
  }
}
```

{% /tab %}
{% tab label="Project Level (project.json)" %}

Named inputs defined in `project.json` define the value of the named input for tasks belonging to the specific project.

Naming a set of inputs with the same name as a set of inputs defined for the workspace in `nx.json` will override the meaning of that set for the project.

```jsonc {% fileName="project.json" highlightLines=["2-6"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"], // Default Inputs
    "production": ["default", "!{projectRoot}/jest.config.ts"], // Production Inputs
    "sharedGlobals": [] // Shared Global Inputs
  },
  "targets": { ... }
}
```

{% /tab %}
{% tab label="Project Level (package.json)" %}

Named inputs defined in `package.json` define the value of the named input for tasks belonging to the specific project.

Naming a set of inputs with the same name as a set of inputs defined for the workspace in `nx.json` will override the meaning of that set for the project.

```jsonc {% fileName="package.json" highlightLines=["3-7"] %}
{
  "dependencies": { ... }
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"], // Default Inputs
    "production": ["default", "!{projectRoot}/jest.config.ts"], // Production Inputs
    "sharedGlobals": [] // Shared Global Inputs
  },
}
```

{% /tab %}
{% /tabs %}

### Named Input Conventions

By default, Nx Workspaces are generated with the following named inputs:

```jsonc {% fileName="nx.json" highlightLines=["2-6"] %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"], // Default Inputs
    "production": ["default", "!{projectRoot}/jest.config.ts"], // Production Inputs
    "sharedGlobals": [] // Shared Global Inputs
  },
  "targetDefaults": {
    "inputs": ["default", "^default"]
  }
}
```

The above inputs follow a convention that Nx recommends for named inputs. Nx generates these by default but you can also introduce your own conventions.

#### Default Inputs

The `default` inputs include all files in a project as well as any shared global inputs which should be considered for all tasks. Defaulting to the set of everything that matters ensures that Nx will always re-run tasks when necessary by default.

#### Shared Global Inputs

The `sharedGlobal` inputs include things that Nx should always look at when determining computation hashes. For instance, this could be the OS where the command is being run or the version of Node.

#### Production Inputs

The `production` inputs only include the set of files in a project which will affect behavior of the project in production.
For instance, the `main.ts` of an application will be compiled as the main application logic and will affect the end user experience while files such as `.eslintrc.json` only affect the tools used by the developers and have no direct impact on the end user experience.
In general, it is best to define the `production` inputs as the `default` inputs (everything) excluding the specific files which are known not to affect end user experience. This makes it so that by default, all files are considered to affect end user behavior unless excluded from the `production` fileset.

### Using Named Inputs

It is common for most tasks to consider a set of inputs for the project it belongs to and a set of inputs for dependencies of the project. For instance, running the tests of a project should consider all files of the project being tested but only production files of its dependencies. The following `inputs` configuration uses named inputs in two different ways:

```jsonc {% fileName="project.json" highlightLines=["5"] %}
{
  "name": "myreactapp",
  "targets": {
    "test": {
      "inputs": ["default", "^production", "{projectRoot}/jest.config.js"]
    }
  }
}
```

1. `default` tells Nx to consider all files within the project root of `myreactapp` when running the `test` task.
2. `^production` is prefixed with `^` and applies the to projects which `myreactapp` depends on: `shared-ui`.
3. You can add other modifications to the inputs set directly without defining them as named inputs.

All of the above inputs are taken into consideration when the following command is run:

```shell
nx test myreactapp
```

## Viewing the Inputs of a Task

You can view the configuration for a task of a project by adding the `--graph` flag when running the command:

```shell
nx build myreactapp --graph
```

This will show the task graph executed by Nx when running the command.

Clicking the task will open a tooltip which lists out all of the inputs of the task. A button within the tooltip will also reveal more details about the configuration for the project which the task belongs to.

[//]: # 'TODO: add gif here'

Doing so will show a view such as the one below:

{% project-details  jsonFile="shared/concepts/myreactapp.json"%}
{% /project-details %}

Nx Console has a button which will show a preview of this screen when a `project.json` or other configuration files are opened in the IDE.

Another way of accessing this information is to run `nx show project myreactapp --web` and the view above will be opened directly.

Use this tool to help understand what inputs are being used by Nx in your workspace.

{% callout title="Note" type="info" %}
If no `inputs` are specified at all, Nx will default to looking at all files of a project and its dependencies. This is a rather cautious approach. This might cause Nx to re-run a task in some cases where the cache could have been used instead but it will always give you correct output.
{% /callout %}

## Configuring Inputs

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

### Workspace

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

### Project Level

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
