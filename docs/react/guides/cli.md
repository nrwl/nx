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

> Substitute `myapp` with the name of your application.

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

## Workspaces and project files

A single workspace configuration file, `workspace.json`, is created at the top level of the workspace. This is where you can set per-project defaults for CLI command options, and specify configurations to use when the CLI builds a project for different targets.

The workspace configuration file is updated when adding new applications, or libaries. You can also edit the workspace.json file directly.

## Command overview

| Command             | Description                                                                             |
| ------------------- | --------------------------------------------------------------------------------------- |
| serve               | Build the application, start up a development web server, and rebuild/reload on changes |
| build               | Build and bundle the application for distribution                                       |
| dep-graph           | Generate a dependency graph for the project                                             |
| lint                | Run the lint checker for the workspace                                                  |
| e2e                 | Run all the E2E tests for the workspace                                                 |
| affected:apps       | Display the list of apps affected by the current changes                                |
| affected:libs       | Display the list of libs affected by the current changes                                |
| affected:build      | Build the apps affected by the current changes                                          |
| affected:e2e        | Run the E2E tests for all projects affected by the current changes                      |
| affected:test       | Run the unit tests for the projects affected by the current changes                     |
| affected:lint       | Run the lint check for the projects affected by the current changes                     |
| affected:dep-graph  | Generate a dependency graph for the affected projects                                   |
| affected            | Display the list of projects affected by the current changes                            |
| format:write        | Run the code formatter across all the projects                                          |
| format:check        | Check the formatted code across all the projects                                        |
| workspace-schematic | Run a workspace schematic                                                               |
| test                | Run the unit tests for all projects                                                     |
| help                | Display usage help for the Nx CLI                                                       |
