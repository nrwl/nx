---
title: '@nx/eslint Generators'
description: 'Complete reference for all @nx/eslint generator commands'
sidebar_label: Generators
---

# @nx/eslint Generators

The @nx/eslint plugin provides various generators to help you create and configure eslint projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `convert-to-flat-config`

Convert an Nx workspace's ESLint configs to use Flat Config.

**Usage:**

```bash
nx generate @nx/eslint:convert-to-flat-config [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

### `convert-to-inferred`

Convert existing Eslint project(s) using `@nx/eslint:lint` executor to use `@nx/eslint/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/eslint:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                  | Default |
| -------------- | ------- | -------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/eslint:lint` executor to use `@nx/eslint/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                         | `false` |

### `workspace-rule`

Create a new Workspace Lint Rule.

**Usage:**

```bash
nx generate @nx/eslint:workspace-rule [options]
```

**Arguments:**

```bash
nx generate @nx/eslint:workspace-rule &lt;name&gt; [options]
```

#### Options

| Option                       | Type   | Description                                                                        | Default |
| ---------------------------- | ------ | ---------------------------------------------------------------------------------- | ------- |
| `--directory` **[required]** | string | Create the rule under this directory within `tools/eslint-rules/` (can be nested). | `rules` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/eslint:<generator> --help
```
