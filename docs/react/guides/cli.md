# Nx CLI

The Nx CLI is a command-line interface tool that helps you setup, develop, build, and maintain applications. It provides commands for:

- Generating new applications, and libraries with recommended defaults.
- Running a development webserver that rebuilds your app on changes.
- Generating a dependency graph for your application.
- Building, and running unit and E2E test for apps, and libraries affected by your changes.
- Formatting your source code to modern standards.

## Installing the CLI

Install the Nx CLI globally on your system using your preferred package manager:

Using npm:

```bash
npm install -g @nrwl/cli
```

Using yarn:

```bash
yarn global add @nrwl/cli
```

Afer the Nx CLI is installed, you will have an `nx` executable you use to run commands in your workspace.

## Basic workflow

Invoke the Nx CLI on the command-line using the `nx` executable. Help is available on the command-line for a short description, and example of available commands.

```bash
nx help
```

To create, build, and serve a new application, go to the root directory of your workspace and use the following commands below.

To generate a new application:

```bash
nx generate @nrwl/react:app myapp
```

> Substitute `myapp` with the name of your application. Also use the `--help` option to see the other options for generating an app.

To start up a development web server:

```bash
nx serve myapp
```

In your browser, visit `http://localhost:4200` to see the new app run. When you use the `nx serve` command to build the app and serve it locally, the app is rebuilt, and the page reloads when any of the source files are changed.

To run unit tests for your application:

```bash
nx test myapp
```

When you're ready to build your app for distribution:

```bash
nx build myapp --prod
```

The distributable application files are located in the `dist/apps/` folder of your workspace.

## Discover

If you want to look at the schematic collections you have installed which can add further features to your app :

```bash
nx list
```

And to list the schematics within a specific collection :

```bash
nx list @nrwl/web
```

This will list all the schematics in the `@nrwl/web` collection.

`nx list` will also output a list of Nrwl-approved plugins that you may want to consider adding to your workspace.

> Visit the [CLI Commands](/react/guides/cli#cli-commands) section to see more available commands.

## Workspaces and project files

A single workspace configuration file, `workspace.json`, is created at the top level of the workspace. This is where you can set per-project defaults for CLI command options, and specify configurations to use when the CLI builds a project for different targets.

The workspace configuration file is updated when adding new applications, or libaries. You can also edit the workspace.json file directly.

## Code Generation

The Nx CLI uses code generators to automate creation of files, configuration of modern tools, and workspace tasks to increase your productivity when using a monorepo. These tasks are accomplished using schematics. Schematics provide the underlying APIs for scaffolding, and utilities to automate changes to your filesystem. The example below is the command to generate a new application.

```sh
nx generate @nrwl/react:application myapp
```

The `@nrwl/react` package contains a collection of schematics, with `application` being the one used in this example. The Nx CLI applies the schematic to your workspace, verifying that the provided options are valid, and the destination files don't already exist. Once the validations are passed, the new files are generated, or existing files are updated. You can also customize the output of the generated application, by passing options to the schematic.

```sh
nx generate @nrwl/react:application myapp --style=scss
```

The command above generates a new application using SASS for styles instead of CSS. You can see the options available to the [application schematic](/react/api/react/schematics/application) and others in the [api docs](/react/api/home).

### Previewing changes

You can preview the changes a schematic makes by using the `--dry-run` option. It will output the potential files created, and/or updated during the execution of the schematic.

### Configuring Defaults

Schematics use the `workspace.json` to look for default values before prompting the user for any additional options. These defaults determine the behavior of how the schematic is applied, and can be customized for each project, or for the entire workspace. Schematics look for defaults in a couple of ways:

- Defaults defined in your project-specific configuration.
- Defaults defined in your workspace-wide configuration.

Defaults are defined under the `schematics` key in your project-specific configuration. Below is a sample `workspace.json` file that defines schematics options specific to the `myapp` project.

```json
{
  "version": 1,
  "projects": {
    "myapp": {
      "root": "apps/myapp",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "schematics": {
        "@nrwl/react:component": {
          "style": "scss"
        }
      },
      "architect": {...}
    }
  }
}
```

For the `myapp` project, each component will be generated using SASS as the style configuration instead of the default. You could also set defaults for any additional options you want to standardize on for that project.

Defaults are defined under the `schematics` top-level key in your `workspace.json` for workspace-wide configuration. Below is a sample `workspace.json` file that defines schematics options that apply to all projects.

```json
{
  "version": 1,
  "projects": {
    "myapp": {
      "root": "apps/myapp",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "schematics": {
        "@nrwl/react:component": {
          "style": "scss"
        }
      }
    }
  },
  "schematics": {
    "@nrwl/react": {
      "component": {
        "style": "css",
        "routing": false
      },
      "library": {
        "style": "css"
      }
    }
  }
}
```

For the workspace, unless overridden, each component will be generated using CSS as the style configuration, and without routing. Defaults can be set using the specific collection and schematic name, or using an object to set defaults for the entire collection.

### Default Collection

You can also set default schematics for your workspace by configuring the `defaultCollection` property in your `workspace.json` file.

```json
{
  "version": 1,
  "projects": {
    "myapp": {
      "root": "apps/myapp",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "schematics": {
        "@nrwl/react:component": {
          "style": "scss"
        }
      }
    }
  },
  "cli": {
    "defaultCollection": "@nrwl/react"
  }
}
```

Setting `@nrwl/react` as the default collection allows you to use shorthand syntax to run the schematics command. Without a default, you have to specify the collection for the schematics.

```sh
nx g @nrwl/react:app mysecondapp
```

With the default set, the command becomes much shorter:

```sh
nx g app mysecondapp
```

> The alias for the `generate` command is `g` in the above example.

## Builders

The Nx CLI uses the Builders API for performing tasks to accomplish a specific task, such as building and bundling your application, running unit tests, or running E2E tests against a specific target, whether that be an application or workspace.

A builder is a function that uses the Architect API to perform a complex process such as "build", "test", or "lint" for a target.

The Nx CLI command `nx run` invokes a builder with a specific target configuration. The workspace configuration file, `workspace.json`, contains default configurations for built-in builders.

An example is the builder named `build` defined in the `@nrwl/web` package. This builder is configured through options defined in the `workspace.json` to bundle your React application for local development, as well as bundle for production distribution. The `dev-server` is another builder that spins up a web-server during local development when you run the `nx serve myapp` command.

To run a builder with the Nx CLI, invoke it with the `nx run` command, passing your project and the target configuration.

```sh
nx run myapp:build
```

The above command will run the `build` configuration against the `myapp` project.

## CLI Commands

The following commands are general commands to peform specific tasks against projects in your workspace, or against your workspace as a whole.

| Command             | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| serve               | Build the application, start up a development web server, and rebuild/reload on changes |
| build               | Build and bundle the application for distribution                                       |
| dep-graph           | Generate a dependency graph for the project                                             |
| lint                | Run the lint checker for the workspace                                                  |
| e2e                 | Run all the E2E tests for the workspace                                                 |
| format:write        | Run the code formatter across all the projects                                          |
| format:check        | Check the formatted code across all the projects                                        |
| workspace-schematic | Run a workspace schematic                                                               |
| test                | Run the unit tests for all projects                                                     |
| help                | Display usage help for the Nx CLI                                                       |

## Determining Affected Projects

The Nx CLI also has built-in commands to show you how your changes impact applications and libraries across your workspace. The Nx CLI constructs and analyzes the dependency graph of all projects in your workspace, and determines the affected projects. These commands are helpful in isolating only the relevant applications, and libraries that were affected from a given change. They also allow you to streamline your CI processes, making them more efficient, only testing/building what's necessary, which improves CI turnaround time.

> Each command can also be run using `nx affected --target={TARGET}`. They can also be provided `--base` and `--head` options that come from your Git repository.

### affected:apps

Display the list of apps affected by the current changes

```sh
nx affected:apps
```

Display the help usage for available options to determine the affected apps.

```sh
nx affected:apps --help
```

---

### affected:libs

Display the list of libs affected by the current changes

```sh
nx affected:libs
```

Display the help usage for available options to determine the affected libs.

```sh
nx affected:libs --help
```

---

### affected:build

Build the apps and libs affected by the current changes

```sh
nx affected:build
```

To use the long form syntax:

```sh
nx affected --target=build
```

Affected builds can also be run in parallel

```sh
nx affected:build --parallel
```

After running the affected:build command, to only rerun failed projects:

```sh
nx affected:build --only-failed
```

You can also compare against a certain base and branch in CI

```sh
nx affected:apps --base=origin/master --head=$CI_BRANCH_NAME
```

---

### affected:e2e

Run the E2E tests for all projects affected by the current

```sh
nx affected:e2e
```

To use the long form syntax:

```sh
nx affected --target=e2e
```

Link check for affected projects can also be run in parallel

```sh
nx affected:e2e --parallel
```

After running the affected:e2e command, to only rerun failed projects:

```sh
nx affected:e2e --only-failed
```

---

### affected:test

Run the unit tests for the projects affected by the current changes

```sh
nx affected:test
```

To use the long form syntax:

```sh
nx affected --target=test
```

Link check for affected projects can also be run in parallel

```sh
nx affected:test --parallel
```

After running the affected:lint command, to only rerun failed projects:

```sh
nx affected:test --only-failed
```

---

### affected:lint

Run the lint check for the projects affected by the current changes

```sh
nx affected:lint
```

To use the long form syntax:

```sh
nx affected --target=lint
```

Link check for affected projects can also be run in parallel

```sh
nx affected:lint --parallel
```

After running the affected:lint command, to only rerun failed projects:

```sh
nx affected:lint --only-failed
```

---

### affected:dep-graph

Generate a dependency graph for the affected projects

```sh
nx affected:dep-graph
```

---

### affected

Display the help usage for available options to determine the affected projects.

```sh
nx affected
```

You can read more about these commands in the guide about [only rebuilding and retesting what is affected](react/guides/monorepo-affected).
