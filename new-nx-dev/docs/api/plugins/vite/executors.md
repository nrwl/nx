---
title: '@nx/vite Executors'
description: 'Complete reference for all @nx/vite executor commands'
sidebar_label: Executors
---

# @nx/vite Executors

The @nx/vite plugin provides various executors to run tasks on your vite projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build`

Builds a Vite.js application for production.

**Usage:**

```bash
nx run &lt;project&gt;:build [options]
```

#### Options

| Option                                  | Type    | Description                                                                                                                                         | Default |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildLibsFromSource`                 | boolean | Read buildable libraries from source instead of building them separately.                                                                           | `true`  |
| `--configFile`                          | string  | The name of the Vite.js configuration file.                                                                                                         |         |
| `--generatePackageJson`                 | boolean | Generate a package.json for the build output.                                                                                                       |         |
| `--includeDevDependenciesInPackageJson` | boolean | Include devDependencies in the generated package.json.                                                                                              |         |
| `--outputPath`                          | string  | The output path of the generated files.                                                                                                             |         |
| `--skipOverrides`                       | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |         |
| `--skipPackageManager`                  | boolean | Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option.                |         |
| `--skipTypeCheck`                       | boolean | Skip type-checking via TypeScript. Skipping type-checking speeds up the build but type errors are not caught.                                       | `false` |
| `--tsConfig`                            | string  | The path to custom tsconfig file for type-checking when skipTypeCheck is false. Required when tsconfig file is not at the projectRoot level.        |         |
| `--useEnvironmentsApi`                  | boolean | Use the new Environments API for building multiple environments at once. Only works with Vite 6.0.0 or higher.                                      | `false` |
| `--watch`                               | string  | Enable re-building when files change.                                                                                                               | `false` |

### `dev-server`

Starts a dev server using Vite.

**Usage:**

```bash
nx run &lt;project&gt;:dev-server [options]
```

#### Options

| Option                         | Type    | Description                                                                                                             | Default |
| ------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildTarget` **[required]** | string  | Target which builds the application. Only used to retrieve the configuration as the dev-server does not build the code. |         |
| `--buildLibsFromSource`        | boolean | Read buildable libraries from source instead of building them separately.                                               | `true`  |
| `--proxyConfig`                | string  | Path to the proxy configuration file.                                                                                   |         |

### `preview-server`

Preview Server for Vite.

**Usage:**

```bash
nx run &lt;project&gt;:preview-server [options]
```

#### Options

| Option                         | Type   | Description                                                                                                                             | Default |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildTarget` **[required]** | string | Target which builds the application.                                                                                                    |         |
| `--proxyConfig`                | string | Path to the proxy configuration file.                                                                                                   |         |
| `--staticFilePath`             | string | Path where the build artifacts are located. If not provided then it will be infered from the buildTarget executor options as outputPath |         |

### `test`

Test using Vitest.

**Usage:**

```bash
nx run &lt;project&gt;:test [options]
```

#### Options

| Option               | Type    | Description                                                          | Default |
| -------------------- | ------- | -------------------------------------------------------------------- | ------- |
| `--configFile`       | string  | The path to the local vitest config, relative to the workspace root. |         |
| `--mode`             | string  | Mode for Vite.                                                       |         |
| `--reportsDirectory` | string  | Directory to write coverage report to.                               |         |
| `--testFiles`        | array   |                                                                      |         |
| `--watch`            | boolean | Watch files for changes and rerun tests related to changed files.    |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
