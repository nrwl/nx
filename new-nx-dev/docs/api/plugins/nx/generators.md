---
title: '@nx/nx Generators'
description: 'Complete reference for all @nx/nx generator commands'
sidebar_label: Generators
---

# @nx/nx Generators

The @nx/nx plugin provides various generators to help you create and configure nx projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `connect-to-nx-cloud`

Connect a workspace to Nx Cloud.

**Usage:**

```bash
nx generate @nx/nx:connect-to-nx-cloud [options]
```

#### Options

| Option                 | Type    | Description                                                                                          | Default |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------- | ------- |
| `--analytics`          | boolean | Anonymously store hashed machine ID for task runs                                                    | `false` |
| `--directory`          | string  | The directory where the workspace is located                                                         |         |
| `--generateToken`      | boolean | Explicitly asks for a token to be created, do not override existing tokens from Nx Cloud             |         |
| `--github`             | boolean | If the user will be using GitHub as their git hosting provider                                       | `false` |
| `--hideFormatLogs`     | boolean | Hide formatting logs                                                                                 |         |
| `--installationSource` | string  | Name of Nx Cloud installation invoker (ex. user, add-nx-to-monorepo, create-nx-workspace, nx-upgrade | `user`  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/nx:<generator> --help
```
