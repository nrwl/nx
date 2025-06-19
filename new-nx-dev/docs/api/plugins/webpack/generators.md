---
title: '@nx/webpack Generators'
description: 'Complete reference for all @nx/webpack generator commands'
sidebar_label: Generators
---

# @nx/webpack Generators

The @nx/webpack plugin provides various generators to help you create and configure webpack projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `convert-config-to-webpack-plugin`

Convert existing Webpack project(s) using `@nx/webpack:webpack` executor that uses `withNx` to use `NxAppWebpackPlugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/webpack:convert-config-to-webpack-plugin [options]
```

#### Options

| Option         | Type    | Description                                                                                                           | Default |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/webpack:webpack` executor and `withNx` plugin to use `NxAppWebpackPlugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                                                  | `false` |

### `convert-to-inferred`

Convert existing Webpack project(s) using `@nx/webpack:wepack` executor to use `@nx/webpack/plugin`.

**Usage:**

```bash
nx generate @nx/webpack:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                                                                                                                 | Default |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/webpack:webpack` executor to use `@nx/webpack/plugin`. If not provided, all projects using the `@nx/webpack:webpack` executor will be converted. |         |
| `--skipFormat` | boolean | Whether to format files.                                                                                                                                                                    | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/webpack:<generator> --help
```
