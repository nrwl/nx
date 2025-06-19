---
title: '@nx/rspack Generators'
description: 'Complete reference for all @nx/rspack generator commands'
sidebar_label: Generators
---

# @nx/rspack Generators

The @nx/rspack plugin provides various generators to help you create and configure rspack projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

React + Rspack application generator.

**Usage:**

```bash
nx generate @nx/rspack:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/rspack:application &lt;directory&gt; [options]
```

#### Options

| Option             | Type    | Description                                     | Default   |
| ------------------ | ------- | ----------------------------------------------- | --------- |
| `--e2eTestRunner`  | string  | The e2e test runner to use.                     | `cypress` |
| `--framework`      | string  | The framework to use for the application.       | `react`   |
| `--monorepo`       | boolean | Creates an integrated monorepo.                 |           |
| `--name`           | string  | The name of the application.                    |           |
| `--rootProject`    | boolean |                                                 |           |
| `--style`          | string  | The file extension to be used for style files.  | `css`     |
| `--tags`           | string  | Add tags to the application (used for linting). |           |
| `--unitTestRunner` | string  | The unit test runner to use.                    | `jest`    |

### `configuration`

Rspack configuration generator.

**Usage:**

```bash
nx generate @nx/rspack:configuration [options]
```

**Arguments:**

```bash
nx generate @nx/rspack:configuration &lt;project&gt; [options]
```

#### Options

| Option          | Type    | Description                                                                                                                   | Default |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildTarget` | string  | The build target of the project to be transformed to use the @nx/vite:build executor.                                         |         |
| `--devServer`   | boolean | Add a serve target to run a local rspack dev-server                                                                           | `false` |
| `--framework`   | string  | The framework used by the project.                                                                                            |         |
| `--main`        | string  | Path relative to the workspace root for the main entry file. Defaults to '&lt;projectRoot&gt;/src/main.ts'.                   |         |
| `--newProject`  | boolean | Is this a new project?                                                                                                        | `false` |
| `--rootProject` | boolean |                                                                                                                               |         |
| `--serveTarget` | string  | The serve target of the project to be transformed to use the @nx/vite:dev-server and @nx/vite:preview-server executors.       |         |
| `--style`       | string  | The style solution to use.                                                                                                    |         |
| `--target`      | string  | Target platform for the build, same as the rspack config option.                                                              | `web`   |
| `--tsConfig`    | string  | Path relative to the workspace root for the tsconfig file to build with. Defaults to '&lt;projectRoot&gt;/tsconfig.app.json'. |         |

#### Examples

```bash
# Initialize rspack in your workspace
nx generate @nx/rspack:init

# Add rspack configuration to a project
nx generate @nx/rspack:configuration --project=my-app
```

### `convert-config-to-rspack-plugin`

Convert existing Rspack project(s) using `@nx/rspack:rspack` executor that uses `withNx` to use `NxAppRspackPlugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/rspack:convert-config-to-rspack-plugin [options]
```

#### Options

| Option         | Type    | Description                                                                                                        | Default |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------ | ------- |
| `--project`    | string  | The project to convert from using the `@nx/rspack:rspack` executor and `withNx` plugin to use `NxAppRspackPlugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                                               | `false` |

### `convert-to-inferred`

Convert existing Rspack project(s) using `@nx/rspack:rspack` executor to use `@nx/rspack/plugin`.

**Usage:**

```bash
nx generate @nx/rspack:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                                                                                                            | Default |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/rspack:rspack` executor to use `@nx/rspack/plugin`. If not provided, all projects using the `@nx/rspack:rspack` executor will be converted. |         |
| `--skipFormat` | boolean | Whether to format files.                                                                                                                                                               | `false` |

### `convert-webpack`

Convert a Webpack project to Rspack.

**Usage:**

```bash
nx generate @nx/rspack:convert-webpack [options]
```

**Arguments:**

```bash
nx generate @nx/rspack:convert-webpack &lt;project&gt; [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/rspack:<generator> --help
```
