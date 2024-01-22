# Inferred Tasks

In Nx version 18, many Nx plugins will automatically infer tasks for your projects based on the configuration of different tools. Many tools have configuration files which determine what a tool does. Nx is able to cache the results of running the tool. Nx plugins use the same configuration files to infer how Nx should [run the task](/features/run-tasks). This includes [fine-tuned cache settings](/features/cache-task-results) and automatic [task dependencies](/concepts/task-pipeline-configuration).

For example, the `@nx/webpack` plugin infers tasks to run webpack through Nx based on your repository's webpack configuration. This configuration already defines the destination of your build files, so Nx reads that value and caches the correct output files.

## How Does a Plugin Infer Tasks?

Every plugin has its own custom logic, but in order to infer tasks, they all go through the following steps.

### 1. Detect Tooling Configuration in Workspace

The plugin will search the workspace for configuration files of the tool. For each configuration file found, the plugin will infer tasks. i.e. The `@nx/webpack` plugin searches for `webpack.config.js` files to infer tasks that run webpack.

### 2. Create an Inferred Task

The plugin then creates tasks with a name that you specified in the plugin's configuration in `nx.json`. The settings for the task are determined by the tool configuration.

The `@nx/webpack` plugin creates tasks named `build`, `serve` and `preview` by default and it automatically sets the task caching settings based on the values in the webpack configuration files.

### What Is Inferred

Nx plugins infer the following properties by analyzing the tool configuration.

- Command - How is the tool invoked
- [Cacheability](https://nx.dev/concepts/how-caching-works) - Whether the task will be cached by Nx. When the Inputs have not changed the Outputs will be restored from the cache.
- [Inputs](https://nx.dev/recipes/running-tasks/customizing-inputs) - Inputs are used by the task to produce Outputs. Inputs are used to determine when the Outputs of a task can be restored from the cache.
- [Outputs](https://nx.dev/reference/project-configuration#outputs) - Outputs are the results of a task. Outputs are restored from the cache when the Inputs are the same as a previous run.
- [Task Dependencies](https://nx.dev/concepts/task-pipeline-configuration) - The list of other tasks which must be completed before running this task.

## Nx Use Plugins to Build the Graph

A typical workspace will have many plugins inferring tasks. Nx processes all the plugins registered in `nx.json` to create project configuration for individual projects and a project and task graph that shows the connections between them all.

### Plugin Order Matters

Plugins are processed in the order that they appear in the `plugins` array in `nx.json`. So, if multiple plugins create a task with the same name, the plugin listed last will win. If, for some reason, you have a project with both a `vite.config.js` file and a `webpack.config.js` file, both the `@nx/vite` plugin and the `@nx/webpack` plugin will try to create a `build` task. The `build` task that is executed will be the task that belongs to the plugin listed lower in the `plugins` array.

### Sources of Project Configuration

Inferred tasks can be overwritten in a couple ways. If you want to overwrite values for multiple projects in a single place, [use the `targetDefaults` object](/reference/nx-json#target-defaults) in the `nx.json` file. If you want to overwrite a value in a specific project, [update that project's configuration](/reference/project-configuration) in `package.json` or `project.json`. Inferred tasks will be overwritten by `targetDefaults` which will also be overwritten by individual project configuration files.

## View Inferred Tasks

To view the task settings that were inferred for a project, show the project details either from the command line or using Nx Console.

```shell
nx show project my-project --web
```

![Inferred task configuration](/shared/concepts/inferred-task-config.png)

## Edit an Inferred Task

To modify a setting for an inferred task, set the specific property you want to override in your project configuration (either `package.json` or `project.json`) and Nx will merge your settings on top of the inferred settings. The easiest way to do this is to use Nx Console's `Edit` button in the project detail view.

// TODO: Put picture here
![Inferred task configuration](/shared/concepts/inferred-task-config.png)
