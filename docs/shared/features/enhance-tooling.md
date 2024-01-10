# Enhance Tooling

Nx is able to enhance your existing tooling in a non-intrusive way so that, without modifying your tooling set-up, Nx can add:

- [Fully configured caching](/features/cache-task-results)
- [Task pipelines](/concepts/task-pipeline-configuration)
- [Task distribution](/ci/features/distribute-task-execution)

Your tooling configuration and repository structure remains unchanged - Nx will make it faster. [Local](/features/cache-task-results) and [remote caching](/ci/features/remote-cache) make it so you'll never do the same work twice. [Task pipelines](/concepts/task-pipeline-configuration) give you the certainty that tasks will always run in the correct order. [Task distribution](/ci/features/distribute-task-execution) allows you to effortlessly parallelize your CI across machines.

This works without any configuration for tools for which there exists an [official plugin](/plugin-registry). Tools without an official plugin can be [manually configured](#manually-define-targets).

{% callout type="warning" title="Nx > 17.3 Required" %}

Automatically setting up targets is a feature released in Nx 17.3. If you are using an earlier version of Nx, you will need to manually define targets.

{% /callout %}

## Setup

The following command will have Nx detect your tooling and set up the appropriate plugins:

```shell
nx init
```

This command will detect the presence of any tooling for which Nx has an [official plugin](/plugin-registry) and give you the option to install the plugin. The installed plugin will be added to your `package.json` file and an entry will be added to the `plugins` array in the `nx.json` file.

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

## Usage

The installed plugin will [infer Nx targets](/concepts/inferred-targets) for you based on the presence of configuration files in your projects. The [nx run](/nx-api/nx/documents/run) cli command (or the shorthand versions) can be used to run targets.

```shell
nx run [project]:[command]
nx run cart:build
```

As long as your command name doesn't conflict with an existing nx cli command, you can use this short hand:

```shell
nx [command] [project]
nx build cart
```

Or omit the project name if you `cd` into the project directory:

```shell
cd [project-path] && nx [command]
cd my-project && nx build
```

You can also add options like this:

```shell
nx [command] [project] --[optionNameInCamelCase]=[value]
nx build my-project --outputPath=some/other/path
```

{% callout type="note" title="Configurable target names" %}
`build` in these examples can be any strings you choose. For the sake of consistency, we make `test` run unit tests for every project and `build` produce compiled code for the projects which can be built.
{% /callout %}

## Types of Targets

Nx targets can be [inferred from tooling configuration files](/concepts/inferred-targets), created from existing `package.json` scripts, or defined in a `project.json` file. Nx will merge all three sources together to determine the targets for a particular project.

Read the [Project Configuration docs](/reference/project-configuration) to see all the configuration options for a target.

## Manually Define Targets

You can manually define a target either in a `package.json` file or a `project.json` file. If you need a target to run `gulp` in the terminal, it would look like this:

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="apps/myapp/package.json"%}
{
  "name": "myapp",
  "dependencies": {},
  "devDependencies": {},
  "scripts": {
    "build": "gulp"
  },
  "nx": {
    "targets": {
      "build": {
        "cache": true,
        "inputs": [
          "production", // all non-test files in this project
          "^production", // all non-test files in dependencies of this project
          { "externalDependencies": ["gulp-cli"] } // the version of the gulp-cli package
        ],
        "outputs": ["{projectRoot}/build"] // build output goes to this folder
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="apps/myapp/project.json"%}
{
  "name": "myapp",
  "targets": {
    "build": {
      "command": "gulp",
      "cache": true,
      "inputs": [
        "production", // all non-test files in this project
        "^production", // all non-test files in dependencies of this project
        { "externalDependencies": ["gulp-cli"] } // the version of the gulp-cli package
      ],
      "outputs": ["{projectRoot}/build"] // build output goes to this folder
    }
  }
}
```

You can also use [executors](/concepts/executors-and-configurations) in your targets when using a `project.json` file.

{% /tab %}
{% /tabs %}

To understand the properties that are defined in this example, read [How Caching Works](/concepts/how-caching-works).

## Modify Inferred Target Options

Any changes to the way the tool itself works should be done in the tool-specific config file. If there are nx-specific settings that need to be changed for a target, you can set that value in the `package.json` or `project.json` file for that project.

For instance, if you need to overwrite the default `outputs` for an inferred `build` target, you can define them like this:

{% tabs %}
{% tab label="package.json" %}

```json {% fileName="apps/myapp/package.json"%}
{
  "name": "myapp",
  "dependencies": {},
  "devDependencies": {},
  "nx": {
    "targets": {
      "build": {
        "outputs": ["{projectRoot}/build", "{projectRoot}/public/build"]
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="apps/myapp/project.json"%}
{
  "name": "myapp",
  "targets": {
    "build": {
      "outputs": ["{projectRoot}/build", "{projectRoot}/public/build"]
    }
  }
}
```

{% /tab %}
{% /tabs %}
