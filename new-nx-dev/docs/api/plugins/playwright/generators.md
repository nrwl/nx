---
title: '@nx/playwright Generators'
description: 'Complete reference for all @nx/playwright generator commands'
sidebar_label: Generators
---

# @nx/playwright Generators

The @nx/playwright plugin provides various generators to help you create and configure playwright projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `configuration`

Add a Playwright configuration.

**Usage:**

```bash
nx generate @nx/playwright:configuration [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project` **[required]**  | string  | The project to add a Playwright configuration to.                                                                                 |         |
| `--directory`               | string  | A directory where the project is placed relative from the project root.                                                           | `e2e`   |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          |         |
| `--rootProject`             | boolean | Create a application at the root of the workspace                                                                                 | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false` |
| `--skipInstall`             | boolean | Skip running `playwright install`. This is to ensure that playwright browsers are installed.                                      | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false` |
| `--webServerAddress`        | string  | The address of the web server.                                                                                                    |         |
| `--webServerCommand`        | string  | The command to start the web server.                                                                                              |         |

#### Examples

```bash
# Initialize playwright in your workspace
nx generate @nx/playwright:init

# Add playwright configuration to a project
nx generate @nx/playwright:configuration --project=my-app
```

### `convert-to-inferred`

Convert existing Playwright project(s) using `@nx/playwright:playwright` executor to use `@nx/playwright/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/playwright:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                                | Default |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/playwright:playwright` executor to use `@nx/playwright/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                                       | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/playwright:<generator> --help
```
