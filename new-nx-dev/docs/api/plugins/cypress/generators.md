---
title: '@nx/cypress Generators'
description: 'Complete reference for all @nx/cypress generator commands'
sidebar_label: Generators
---

# @nx/cypress Generators

The @nx/cypress plugin provides various generators to help you create and configure cypress projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `configuration`

Add a Cypress configuration to an existing project.

**Usage:**

```bash
nx generate @nx/cypress:configuration [options]
```

**Aliases:** `cypress-e2e-configuration`, `e2e`, `e2e-config`

#### Options

| Option                      | Type    | Description                                                                                                                                                                                                                                                                                                               | Default   |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--project` **[required]**  | string  | The project to add a Cypress configuration to                                                                                                                                                                                                                                                                             |           |
| `--baseUrl`                 | string  | The address (with the port) which your application is running on. If you wish to start your application when running the e2e target, then use --devServerTarget instead.                                                                                                                                                  |           |
| `--bundler`                 | string  | The Cypress bundler to use.                                                                                                                                                                                                                                                                                               | `webpack` |
| `--devServerTarget`         | string  | A devServerTarget,'&lt;projectName&gt;:&lt;targetName&gt;[:&lt;configName&gt;], that will be used to run tests against. This is usually the app this project will be used in. Pass --baseUrl if you wish to not use a devServerTarget.                                                                                    |           |
| `--directory`               | string  | A directory where the project is placed relative from the project root                                                                                                                                                                                                                                                    | `cypress` |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                                                                                                                                                                                                                   | `false`   |
| `--jsx`                     | boolean | Whether or not this project uses JSX.                                                                                                                                                                                                                                                                                     | `true`    |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                                                                                                                                                  |           |
| `--port`                    | string  | Set the 'port' option on the e2e target. It's recommend to set a different port so you can run tests e2e targets in parallel. Most dev servers support using '0' to automatically find a free port. The value 'cypress-auto' can be used if the underlying dev server does not support automatically finding a free port. |           |
| `--rootProject`             | boolean | Create a application at the root of the workspace                                                                                                                                                                                                                                                                         | `false`   |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                                                                                                                                                         | `false`   |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                                                                                                                                                    | `false`   |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                                                                                                                                                | `false`   |

#### Examples

```bash
# Initialize cypress in your workspace
nx generate @nx/cypress:init

# Add cypress configuration to a project
nx generate @nx/cypress:configuration --project=my-app
```

### `convert-to-inferred`

Convert existing Cypress project(s) using `@nx/cypress:cypress` executor to use `@nx/cypress/plugin`.

**Usage:**

```bash
nx generate @nx/cypress:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                       | Default |
| -------------- | ------- | ------------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/cypress:cypress` executor to use `@nx/cypress/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                              | `false` |

### `migrate-to-cypress-11`

Migrate Cypress e2e project from v8/v9 to Cypress v11.

**Usage:**

```bash
nx generate @nx/cypress:migrate-to-cypress-11 [options]
```

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/cypress:<generator> --help
```
