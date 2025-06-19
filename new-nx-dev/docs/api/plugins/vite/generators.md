---
title: '@nx/vite Generators'
description: 'Complete reference for all @nx/vite generator commands'
sidebar_label: Generators
---

# @nx/vite Generators

The @nx/vite plugin provides various generators to help you create and configure vite projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `configuration`

Configure a project to use Vite.js.

**Usage:**

```bash
nx generate @nx/vite:configuration [options]
```

**Aliases:** `config`

**Arguments:**

```bash
nx generate @nx/vite:configuration &lt;project&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                | Default |
| ------------------- | ------- | -------------------------------------------------------------------------- | ------- |
| `--compiler`        | string  | Compiler to use for Vite when UI Framework is React.                       | `babel` |
| `--includeLib`      | boolean | Add a library build option and skip the server option.                     |         |
| `--includeVitest`   | boolean | Use vitest for the test suite.                                             |         |
| `--newProject`      | boolean | Is this a new project?                                                     | `false` |
| `--port`            | number  | The port to use for the development server                                 |         |
| `--skipFormat`      | boolean | Skip formatting files.                                                     | `false` |
| `--testEnvironment` | string  | The vitest environment to use. See https://vitest.dev/config/#environment. | `jsdom` |
| `--uiFramework`     | string  | UI Framework to use for Vite.                                              | `none`  |

#### Examples

```bash
# Initialize vite in your workspace
nx generate @nx/vite:init

# Add vite configuration to a project
nx generate @nx/vite:configuration --project=my-app
```

### `convert-to-inferred`

Convert existing Vite project(s) using `@nx/vite:*` executors to use `@nx/vite/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/vite:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                            | Default |
| -------------- | ------- | -------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/vite:*` executors to use `@nx/vite/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                   | `false` |

### `setup-paths-plugin`

Updates vite config files to enable support for workspace libraries via the nxViteTsPaths plugin.

**Usage:**

```bash
nx generate @nx/vite:setup-paths-plugin [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

### `vitest`

Generate a Vitest setup for a project.

**Usage:**

```bash
nx generate @nx/vite:vitest [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                     | Default |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project` **[required]**  | string  | The name of the project to test.                                                                                                                                                                |         |
| `--compiler`                | string  | The compiler to use                                                                                                                                                                             | `babel` |
| `--coverageProvider`        | string  | Coverage provider to use.                                                                                                                                                                       | `v8`    |
| `--inSourceTests`           | boolean | Do not generate separate spec files and set up in-source testing.                                                                                                                               | `false` |
| `--runtimeTsconfigFileName` | string  | The name of the project's tsconfig file that includes the runtime source files. If not provided, it will default to `tsconfig.lib.json` for libraries and `tsconfig.app.json` for applications. |         |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                          | `false` |
| `--skipViteConfig`          | boolean | Skip generating a vite config file.                                                                                                                                                             | `false` |
| `--testEnvironment`         | string  | The vitest environment to use. See https://vitest.dev/config/#environment.                                                                                                                      |         |
| `--testTarget`              | string  | The test target of the project to be transformed to use the @nx/vite:test executor.                                                                                                             |         |
| `--uiFramework`             | string  | UI framework to use with vitest.                                                                                                                                                                |         |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/vite:<generator> --help
```
