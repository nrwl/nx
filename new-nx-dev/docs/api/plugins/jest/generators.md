---
title: '@nx/jest Generators'
description: 'Complete reference for all @nx/jest generator commands'
sidebar_label: Generators
---

# @nx/jest Generators

The @nx/jest plugin provides various generators to help you create and configure jest projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `convert-to-inferred`

Convert existing Jest project(s) using `@nx/jest:jest` executor to use `@nx/jest/plugin`.

**Usage:**

```bash
nx generate @nx/jest:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                                                                                                  | Default |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/jest:jest` executor to use `@nx/jest/plugin`. If not provided, all projects using the `@nx/jest:jest` executor will be converted. |         |
| `--skipFormat` | boolean | Whether to format files.                                                                                                                                                     | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/jest:<generator> --help
```
