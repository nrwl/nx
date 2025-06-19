---
title: '@nx/esbuild Generators'
description: 'Complete reference for all @nx/esbuild generator commands'
sidebar_label: Generators
---

# @nx/esbuild Generators

The @nx/esbuild plugin provides various generators to help you create and configure esbuild projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `configuration`

Add esbuild configuration to a project.

**Usage:**

```bash
nx generate @nx/esbuild:configuration [options]
```

**Aliases:** `esbuild-project`

**Arguments:**

```bash
nx generate @nx/esbuild:configuration &lt;project&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                                                                                                                                    | Default   |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--buildTarget`     | string  | The build target to add.                                                                                                                                                                       | `build`   |
| `--format`          | array   | The format to build the library (esm or cjs).                                                                                                                                                  | `["esm"]` |
| `--importPath`      | string  | The library name used to import it, like `@myorg/my-awesome-lib`.                                                                                                                              |           |
| `--main`            | string  | Path relative to the workspace root for the main entry file. Defaults to `&lt;project-root&gt;/src/main.ts` or `&lt;project-root&gt;src/index.ts`, whichever is found.                         |           |
| `--platform`        | string  | Platform target for outputs.                                                                                                                                                                   | `node`    |
| `--skipFormat`      | boolean | Skip formatting files.                                                                                                                                                                         | `false`   |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`.                                                                                                                                                     | `false`   |
| `--skipValidation`  | boolean | Do not perform any validation on existing project.                                                                                                                                             | `false`   |
| `--tsConfig`        | string  | Path relative to the workspace root for the tsconfig file to build with. Defaults to `&lt;project-root&gt;/tsconfig.app.json` or `&lt;project-root&gt;/tsconfig.lib.json`, whichever is found. |           |

#### Examples

```bash
# Initialize esbuild in your workspace
nx generate @nx/esbuild:init

# Add esbuild configuration to a project
nx generate @nx/esbuild:configuration --project=my-app
```

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/esbuild:<generator> --help
```
