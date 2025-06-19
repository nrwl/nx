---
title: '@nx/gradle Generators'
description: 'Complete reference for all @nx/gradle generator commands'
sidebar_label: Generators
---

# @nx/gradle Generators

The @nx/gradle plugin provides various generators to help you create and configure gradle projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `ci-workflow`

Setup a CI Workflow to run Nx in CI.

**Usage:**

```bash
nx generate @nx/gradle:ci-workflow [options]
```

**Arguments:**

```bash
nx generate @nx/gradle:ci-workflow &lt;name&gt; [options]
```

#### Options

| Option                | Type   | Description  | Default |
| --------------------- | ------ | ------------ | ------- |
| `--ci` **[required]** | string | CI provider. |         |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/gradle:<generator> --help
```
