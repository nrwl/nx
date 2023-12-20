# Inferred Targets

In Nx version 17.3, many of the official Nx plugins gain the ability to automatically infer targets for your projects based on the presence of tooling config files. For instance, the `@nx/eslint` plugin can infer a `lint` target in any project that contains a `.eslintrc.json` file.

## What is an Inferred Target?

An inferred target is an executable target for a project - just like a `package.json` script or an explicitly defined `project.json` target - but these targets are created on the fly based on the tooling config files that are present in your project. The targets can be executed in the same way any target can (i.e. `nx test` or `nx build`).

Let's take the `@nx/eslint` plugin for example. If you turn on target inference for the plugin in the `nx.json` file, the plugin will scan the projects in your repo for inferred targets. If a project has a `.eslintrc.json` file, but no explicitly defined `lint` target in `package.json` or `project.json`, the `@nx/eslint` plugin will add a `lint` target for you.

Inferred targets are created with the following principles in mind:

- As much as possible, tooling configuration stays in the tool configuration files.  
  i.e. There should not be executor options that duplicate the tooling configuration.
- Running an inferred target should be identical to launching that tool in the project directory.  
  i.e. Running `nx lint my-project` should be the same as running `eslint .` from the `my-project` directory.
- Inferred options (such as `inputs` and `outputs`) should be calculated from the tooling config.
- Default set up should have very little nx-specific config
- All default settings can be overwritten in the project configuration (`package.json` or `project.json`)

## Setup Inferred Targets

To start using inferred targets, you need to:

1. Install the plugin

   ```shell
   npm i -D @nx/eslint
   ```

2. Enable inferred targets in the `nx.json` file

   ```json {% fileName="nx.json" %}
   {
     "plugins": [
       {
         "plugin": "@nx/eslint/plugin",
         "options": {
           "targetName": "lint"
         }
       }
     ]
   }
   ```

## How Exactly Does a Plugin Create an Inferred Target?

Every plugin has its own custom logic, but in order to infer targets, they all go through the following steps.

### 1. Detect Tooling Config in Projects

The plugin will check each project in your repo for tooling configuration files. The `@nx/eslint` plugin checks for `.eslintrc.json` files at the root of the project. If the configuration files are found, targets are inferred for that project.

### 2. Create an Inferred Target

The plugin will create a target for you that will use the tooling config that was detected. The name for the target (i.e. `lint`) is set in the `options` for the plugin in `nx.json`.

### 3. Set Inferred Target Options Based on Tooling Config

The plugin will automatically set options for the inferred targets. This includes, at a minimum, `inputs` and `outputs`.

## Configuration Precedence

As much as possible, tooling configuration stays in the tooling configuration files themselves. For nx-specific target configuration, there are three possible sources:

- `targetDefaults` in the `nx.json` file
- Inferred values from plugins
- Project-specific configuration in `package.json` or `project.json`

The target configuration is calculated in that order. Project-specific configuration overwrites inferred values, which overwrite the `targetDefaults`.

## Debug Inferred Targets

To view the target settings that were inferred for a project, show the project details either from the command line or using Nx Console.

```shell
nx show project my-project --web
```

![Inferred target configuration](/shared/concepts/inferred-target-config.png)

## Why Use Inferred Targets?

The main value of inferred targets differs based on the kind of repository you have.

For a package-based repository, inferred targets allow you to adopt an Nx plugin without any need to adjust your existing tooling configuration. Since the plugin is directly invoking the tool, if you're tooling configuration worked before, it will continue to work when run through Nx. In addition, the plugin will apply the correct `inputs` and `outputs` based on your configuration so that caching will work as expected. You'll also be able to automatically update tool versions and config files so that breaking changes from your tooling will no longer be a hassle.

For an integrated repository, inferred targets allow you to remove any targets from your `project.json` files that are simply using the default settings. You'll only need to specify values that are unique to that project. You'll also be able to keep all configuration for a tool in the tool's configuration files - instead of having to check Nx config files to debug the tool. In addition, the plugin will apply the correct `inputs` and `outputs` based on your configuration so that caching will work as expected.
