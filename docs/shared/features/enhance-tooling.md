# Enhance Tooling

Nx is able to enhance your existing tooling in a non-intrusive way so that, without modifying your tooling set-up, Nx can add:

- [Fully configured caching](/features/cache-task-results)
- [Task pipelines](/concepts/task-pipeline-configuration)
- [Task distribution](/ci/features/distribute-task-execution)

This works for any tool for which there exists an [official plugin](/plugin-registry).

## Setup

The following command will make Nx detect your tooling and set up the appropriate plugins:

```shell
nx init
```

This command will detect the presence of any tooling for which Nx has an [official plugin](/plugin-registry) and give you the option to install the plugin. The installed plugin will be added to your `package.json` file and an entry will be added to the `plugins` array in the `nx.json` file.

## Usage

The installed plugin will [infer Nx targets](/concepts/inferred-targets) for you based on the presence of configuration files in your projects. You can invoke your targets with a command like this.

The [`nx run`](/nx-api/nx/documents/run) cli command (or the shorthand versions) can be used to run targets.

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

## Modifying the Target Options

Any changes to the way the tool itself works should be done in the tool-specific config file. If there are nx-specific settings that need to be changed for a project, you can set that value in the `package.json` or `project.json` file for that project.

For instance, if you need to set the `outputs` for the `build` target, you can define them like this:

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
      "outputs": ["dist/dist/myapp"]
    }
  }
}
```

{% /tab %}
{% /tabs %}
