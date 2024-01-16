# Inferred Tasks

In Nx version 17.3, many of the official Nx plugins gain the ability to automatically infer tasks for your projects based on the presence of tooling config files. For instance, the `@nx/eslint` plugin can infer a `lint` task in any project that contains an `.eslintrc.json` file.

## What is an Inferred Task?

An inferred task is an executable task for a project - just like a `package.json` script or an explicitly defined `project.json` task - but these tasks are created on the fly based on the tooling config files that are present in your project. The tasks can be executed in the same way any task can (i.e. `nx test` or `nx build`).

Let's take the `@nx/eslint` plugin for example. If you turn on task inference for the plugin in the `nx.json` file, the plugin will scan the projects in your repo for inferred tasks. If a project has an `.eslintrc.json` file, but no explicitly defined `lint` task in `package.json` or `project.json`, the `@nx/eslint` plugin will add a `lint` task for you.

Inferred tasks are created with the following principles in mind:

- As much as possible, tooling configuration stays in the tool configuration files.  
  i.e. There should not be executor options that duplicate the tooling configuration.
- Running an inferred task should be identical to launching that tool in the project directory.  
  i.e. Running `nx lint my-project` should be the same as running `eslint .` from the `my-project` directory.
- Inferred options (such as `inputs` and `outputs`) should be calculated from the tooling config.
- Default set up should have very little nx-specific config
- All default settings can be overwritten in the project configuration (`package.json` or `project.json`)

## Setup Inferred Tasks

To start using inferred tasks, you need to:

1. Install the plugin

   ```shell
   npm i -D @nx/eslint
   ```

2. Enable inferred tasks in the `nx.json` file

   ```json {% fileName="nx.json" %}
   {
     "plugins": [
       {
         "plugin": "@nx/eslint/plugin",
         "options": {
           "taskName": "lint"
         }
       }
     ]
   }
   ```

## How Exactly Does a Plugin Create an Inferred Task?

Every plugin has its own custom logic, but in order to infer tasks, they all go through the following steps.

### 1. Detect Tooling Config in Projects

The plugin will check each project in your repo for tooling configuration files. The `@nx/eslint` plugin checks for `.eslintrc.json` files at the root of the project. If the configuration files are found, tasks are inferred for that project.

### 2. Create an Inferred Task

The plugin will create a task for you that will use the tooling config that was detected. The name for the task (i.e. `lint`) is set in the `options` for the plugin in `nx.json`.

### 3. Set Inferred Task Options Based on Tooling Config

The plugin will automatically set options for the inferred tasks. This includes, at a minimum, `inputs` and `outputs`.

## Configuration Precedence

As much as possible, tooling configuration stays in the tooling configuration files themselves. For nx-specific task configuration, there are three possible sources:

- `taskDefaults` in the `nx.json` file
- Inferred values from plugins
- Project-specific configuration in `package.json` or `project.json`

The task configuration is calculated in that order. Project-specific configuration overwrites inferred values, which overwrite the `taskDefaults`.

## Debug Inferred Tasks

To view the task settings that were inferred for a project, show the project details either from the command line or using Nx Console.

```shell
nx show project my-project --web
```

![Inferred task configuration](/shared/concepts/inferred-task-config.png)

## Edit an Inferred Task

To modify a setting for an inferred task, set the specific property you want to override in your project configuration (either `package.json` or `project.json`) and Nx will merge your settings on top of the inferred settings. The easiest way to do this is to use Nx Console's `Edit` button in the project detail view.

// TODO: Put picture here
![Inferred task configuration](/shared/concepts/inferred-task-config.png)

## Why Use Inferred Tasks?

The main value of inferred tasks differs based on the kind of repository you have.

For a package-based repository, inferred tasks allow you to adopt an Nx plugin without any need to adjust your existing tooling configuration. Since the plugin is directly invoking the tool, if you're tooling configuration worked before, it will continue to work when run through Nx. In addition, the plugin will apply the correct `inputs` and `outputs` based on your configuration so that caching will work as expected. You'll also be able to automatically update tool versions and config files so that breaking changes from your tooling will no longer be a hassle.

For an integrated repository, inferred tasks allow you to remove any tasks from your `project.json` files that are simply using the default settings. You'll only need to specify values that are unique to that project. You'll also be able to keep all configuration for a tool in the tool's configuration files - instead of having to check Nx config files to debug the tool. In addition, the plugin will apply the correct `inputs` and `outputs` based on your configuration so that caching will work as expected.
