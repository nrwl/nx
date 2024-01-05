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

The installed plugin will [infer Nx targets](/concepts/inferred-targets) for you based on the presence of configuration files in your projects. You can invoke your existing tooling with a command like this.

{% side-by-side %}

```shell
nx build my-project
```

```shell
cd my-project && nx build
```

{% /side-by-side %}

{% callout type="note" title="Configurable target names" %}
`build` and `test` can be any strings you choose. For the sake of consistency, we make `test` run unit tests for every project and `build` produce compiled code for the projects which can be built.
{% /callout %}

## Types of Targets

Nx targets can be [inferred from tooling configuration files](/concepts/inferred-targets), created from existing `package.json` scripts, or defined in a `project.json` file. Nx will merge all three sources together to determine the targets for a particular project.

## Modifying the Inferred Target

Executors are associated with specific targets in a project's `project.json` file.

```jsonc {% fileName="project.json" %}
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "outputPath": "dist/apps/cart",
        ...
      },
      "configurations": {
        "production": {
          "sourceMap": false,
          ...
        }
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        ...
      }
    }
  }
}
```

Each project has targets configured to run an executor with a specific set of options. In this snippet, `cart` has two targets defined - `build` and `test`.

Each executor definition has an `executor` property and, optionally, an `options` and a `configurations` property.

- `executor` is a string of the form `[package name]:[executor name]`. For the `build` executor, the package name is `@nx/webpack` and the executor name is `webpack`.
- `options` is an object that contains any configuration defaults for the executor. These options vary from executor to executor.
- `configurations` allows you to create presets of options for different scenarios. All the configurations start with the properties defined in `options` as a baseline and then overwrite those options. In the example, there is a `production` configuration that overrides the default options to set `sourceMap` to `false`.

## Running executors

The [`nx run`](/nx-api/nx/documents/run) cli command (or the shorthand versions) can be used to run executors.

```shell
nx run [project]:[command]
nx run cart:build
```

As long as your command name doesn't conflict with an existing nx cli command, you can use this short hand:

```shell
nx [command] [project]
nx build cart
```

You can also use a specific configuration preset like this:

```shell
nx [command] [project] --configuration=[configuration]
nx build cart --configuration=production
```

Or you can overwrite individual executor options like this:

```shell
nx [command] [project] --[optionNameInCamelCase]=[value]
nx build cart --outputPath=some/other/path
```

## Running a single command

If defining a new target that needs to run a single shell command, there is a shorthand for the `nx:run-commands` executor that can be used.

```jsonc {% fileName="project.json" %}
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "echo": {
      "command": "echo 'hello world'"
    }
  }
}
```

For more info, see the [run-commands documentation](/nx-api/nx/executors/run-commands)

## Use Task Configurations

The `configurations` property provides extra sets of values that will be merged into the options map.

```json {% fileName="project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "outputs": ["{workspaceRoot}/dist/libs/mylib"],
    "dependsOn": ["^build"],
    "options": {
      "tsConfig": "libs/mylib/tsconfig.lib.json",
      "main": "libs/mylib/src/main.ts"
    },
    "configurations": {
      "production": {
        "tsConfig": "libs/mylib/tsconfig-prod.lib.json"
      }
    }
  }
}
```

You can select a configuration like this: `nx build mylib --configuration=production`
or `nx run mylib:build:production`.

The following code snippet shows how the executor options get constructed:

```javascript
require(`@nx/jest`).executors['jest']({
  ...options,
  ...selectedConfiguration,
  ...commandLineArgs,
}); // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the
configuration options.

### Default Configuration

When using multiple configurations for a given target, it's helpful to provide a default configuration.
For example, running e2e tests for multiple environments. By default it would make sense to use a `dev` configuration for day to day work, but having the ability to run against an internal staging environment for the QA team.

```json {% fileName="project.json" %}
{
  "e2e": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/my-app-e2e/cypress.config.ts"
    },
    "configurations": {
      "dev": {
        "devServerTarget": "my-app:serve"
      },
      "qa": {
        "baseUrl": "https://some-internal-url.example.com"
      }
    },
    "defaultConfiguration": "dev"
  }
}
```

When running `nx e2e my-app-e2e`, the _dev_ configuration will be used. In this case using the local dev server for `my-app`.
You can always run the other configurations by explicitly providing the configuration i.e. `nx e2e my-app-e2e --configuration=qa` or `nx run my-app-e2e:e2e:qa`

## Build your own Executor

Nx comes with a Devkit that allows you to build your own executor to automate your Nx workspace. Learn more about it in the [docs page about creating a local executor](/extending-nx/recipes/local-executors).
