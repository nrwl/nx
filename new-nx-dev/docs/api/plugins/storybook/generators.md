---
title: '@nx/storybook Generators'
description: 'Complete reference for all @nx/storybook generator commands'
sidebar_label: Generators
---

# @nx/storybook Generators

The @nx/storybook plugin provides various generators to help you create and configure storybook projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `configuration`

Add Storybook configuration to a UI library or an application.

**Usage:**

```bash
nx generate @nx/storybook:configuration [options]
```

**Arguments:**

```bash
nx generate @nx/storybook:configuration &lt;project&gt; [options]
```

#### Options

| Option                         | Type    | Description                                                                                                               | Default  |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--uiFramework` **[required]** | string  | Storybook UI Framework to use.                                                                                            |          |
| `--configureStaticServe`       | boolean | Add a static-storybook to serve the static storybook built files.                                                         | `false`  |
| `--interactionTests`           | boolean | Set up Storybook interaction tests.                                                                                       | `true`   |
| `--js`                         | boolean | Generate JavaScript story files rather than TypeScript story files.                                                       | `false`  |
| `--linter`                     | string  | The tool to use for running lint checks.                                                                                  | `eslint` |
| `--skipFormat`                 | boolean | Skip formatting files.                                                                                                    | `false`  |
| `--standaloneConfig`           | boolean | Split the project configuration into `&lt;projectRoot&gt;/project.json` rather than including it inside `workspace.json`. | `true`   |
| `--tsConfiguration`            | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js.         | `true`   |

#### Examples

```bash
# Initialize storybook in your workspace
nx generate @nx/storybook:init

# Add storybook configuration to a project
nx generate @nx/storybook:configuration --project=my-app
```

### `convert-to-inferred`

Convert existing Storybook project(s) using `@nx/storybook:*` executors to use `@nx/storybook/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/storybook:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                      | Default |
| -------------- | ------- | ------------------------------------------------------------------------------------------------ | ------- |
| `--project`    | string  | The project to convert from using the `@nx/storybook:*` executors to use `@nx/storybook/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                             | `false` |

### `migrate-8`

Migrate Storybook to version 8.

**Usage:**

```bash
nx generate @nx/storybook:migrate-8 [options]
```

#### Options

| Option                     | Type    | Description                                                                                                                   | Default |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--autoAcceptAllPrompts`   | boolean | Say yes to all the prompts from the Storybook CLI migration scripts.                                                          | `false` |
| `--noUpgrade`              | boolean | Skip upgrading Storybook packages. Only use this option if you are already on version 8, and you do not want the latest beta. | `false` |
| `--onlyShowListOfCommands` | boolean | Only show the steps that you need to follow in order to migrate. This does NOT make any changes to your code.                 | `false` |

### `migrate-9`

Migrate Storybook to version 9.

**Usage:**

```bash
nx generate @nx/storybook:migrate-9 [options]
```

#### Options

| Option                     | Type    | Description                                                                                                                                 | Default  |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--autoAcceptAllPrompts`   | boolean | Say yes to all the prompts from the Storybook CLI migration scripts.                                                                        | `false`  |
| `--noUpgrade`              | boolean | Skip upgrading Storybook packages. Only use this option if you are already on version 9, and you do not want to install the packages again. | `false`  |
| `--onlyShowListOfCommands` | boolean | Only show the steps that you need to follow in order to migrate. This does NOT make any changes to your code.                               | `false`  |
| `--versionTag`             | string  | The version of Storybook to use. Use 'latest' to use the latest stable version, or 'next' to use the latest beta.                           | `latest` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/storybook:<generator> --help
```
