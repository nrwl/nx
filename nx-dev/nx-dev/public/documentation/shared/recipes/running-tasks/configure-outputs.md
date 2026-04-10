---
title: Configure Outputs for Task Caching
description: 'Learn how to optimize what Nx restores from the cache'
---

# Configure Outputs for Task Caching

Whenever Nx runs a cacheable task, it will store the results of that task in the cache.
When Nx runs the task again, if the [inputs for that task](/recipes/running-tasks/configure-inputs) have not changed, it will restore the results from the cache instead of spending the time to run the task again.

## Types of Outputs

### Terminal Output

The terminal output of a task is replayed whenever a task is pulled from cache. Nx will always cache the terminal output of tasks which are cached.

### Output Files

Targets can define which files are produced when a task is run. Nx will cache these files so that it can restore them when the task is pulled from cache.

These outputs files can be specified in several ways:

```jsonc
"outputs": [
  "{projectRoot}/dist/libs/mylib", // A directory
  "{workspaceRoot}/dist/{projectRoot}", // A directory based on the project's root
  "{workspaceRoot}/dist/{projectName}", // A directory based on the project's name
  "{workspaceRoot}/test-results.xml", // A file
  "{projectRoot}/dist/libs/mylib/**/*.js", // A glob pattern matching a set of files
  "{options.outputPath}", // A path defined in the options of a task
]
```

All outputs explicitly specifying paths must be prefixed with either `{projectRoot}` or `{workspaceRoot}` to distinguish where the path is resolved from. `{workspaceRoot}` should only appear in the beginning of an `output` but `{projectRoot}` and `{projectName}` can be specified later in the `output` to interpolate the root or name of the project into the output location.

Outputs can also be determined from the `options` of running a task via the `{options.[propertyName]}` syntax.
This is useful when an option for the task determines the output location and could be modified when the task is run.
This path is resolved from the root of the workspace.

If an output file or directory does not exist, it will be ignored.

## View Outputs of a Task

The outputs of a task can be viewed by adding the `--graph` flag to the command:

```shell
nx build myapp --graph
```

This will open the task graph in the browser.
Clicking on a task in the graph will open a tooltip with a link to see details about the project.
View the project's configuration to see a list of the outputs which are defined for each target.

## Configure Outputs

The tasks you run in your workspace will likely already have `outputs` defined.
Be sure to [view the existing outputs](#viewing-outputs-of-a-task) and start from there.

As of Nx 18, Nx Plugins often [infer outputs for tasks](/concepts/inferred-tasks) which run other tools.
Nx Plugins will look at the configuration files and/or command-line-arguments of the tools in your workspace to understand the outputs of running those tools.
In most cases, this inference will be inline with the outputs of the tool.
Nx will reflect changes to the configuration or command-line arguments of your tools without any additional changes.

In some cases, Nx plugins may not infer the outputs of a task as you expect, they can be configured in the `outputs` array on the target. This can be done in several different places:

- The `outputs` array in the `targetDefaults` for a set of targets in `nx.json`.
- The `outputs` array for a specific target in the project configuration file.

{% callout title="Copy the existing outputs before modifying outputs for a task" %}
To override the `outputs` of a task, start by copying over the entire array shown when [viewing the project details](#viewing-the-outputs-of-a-task) and then add/modify/remove outputs as needed.
{% /callout %}

As you configure `outputs`, keep the project details screen open and it will refresh as changes are made. Check to make sure that the intended configuration is shown.

### Workspace Level Outputs

[Target Defaults](/reference/nx-json#target-defaults) defined in `nx.json` apply to a set of targets. Defining `outputs` here one time will apply to a set of similar targets.

```jsonc {% fileName="nx.json" highlightLines=[4] %}
{
  "targetDefaults": {
    "build": {
      "outputs": ["{projectRoot}/dist"]
    }
  }
}
```

The above specifies Nx will cache the `dist` directory under all project roots for all targets with the name `build`.
This configuration will override any `outputs` inferred by Nx Plugins as you have more direct control in your `nx.json` than the behavior of the Nx Plugin.
The configuration defined here completely overwrites any `outputs` inferred by Nx Plugins and is not merged in any way.
This configuration may be overwritten by configuration in project-specific configuration files.

{% callout title="Warning" type="warning" %}
Specifying the same output location for multiple tasks often causes unintentional behavior. While sometimes this is intentional, try and ensure that a set of targets will yield unique output locations for the tasks belonging to different projects. Use the `{projectRoot}` and `{projectName}` notation to include unique characteristics of a project in the output.
{% /callout %}

### Project Level Outputs

Defining `outputs` of a target in `project.json` or `package.json` will apply only to tasks of the specific project.

{% tabs %}
{% tab label="project.json" %}

```jsonc {% fileName="apps/myreactapp/project.json" highlightLines=[5] %}
{
  "name": "myreactapp",
  "targets": {
    "build": {
      "outputs": ["{projectRoot}/dist"]
    }
  }
}
```

{% /tab %}
{% tab label="package.json" %}

The `package.json` file may include configuration for a specific Nx project. Defining `outputs` of a target here will apply only to tasks of the specific project.

```jsonc {% fileName="apps/myreactapp/package.json" highlightLines=[9] %}
{
  "name": "myreactapp",
  "dependencies": {},
  "devDependencies": {},
  ...
  "nx": {
    "targets": {
      "build": {
        "outputs": ["{projectRoot}/dist"]
      }
      ...
    }
  }
}
```

{% /tab %}
{% /tabs %}

The above specifies that the `build` target of the `myreactapp` project will use the `outputs` specified.
This configuration will override any `outputs` inferred by Nx Plugins as well as any `outputs` defined in the [Target Defaults](/reference/nx-json#target-defaults) in the `nx.json` file as this is more specific than those other methods of configuring `outputs`.
The configuration defined here completely overwrites any `outputs` inferred by Nx Plugins or in target defaults and is not merged in any way.
