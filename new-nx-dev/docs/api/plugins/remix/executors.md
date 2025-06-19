---
title: '@nx/remix Executors'
description: 'Complete reference for all @nx/remix executor commands'
sidebar_label: Executors
---

# @nx/remix Executors

The @nx/remix plugin provides various executors to run tasks on your remix projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build`

Build a Remix app.

**Usage:**

```bash
nx run &lt;project&gt;:build [options]
```

#### Options

| Option                                  | Type    | Description                                                                                                                                         | Default |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--outputPath` **[required]**           | string  | The output path of the generated files.                                                                                                             |         |
| `--generateLockfile`                    | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match.                                  | `false` |
| `--generatePackageJson`                 | boolean | Generate package.json file in the output folder.                                                                                                    | `false` |
| `--includeDevDependenciesInPackageJson` | boolean | Include `devDependencies` in the generated package.json file. By default only production `dependencies` are included.                               | `false` |
| `--skipOverrides`                       | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option. |         |
| `--skipPackageManager`                  | boolean | Do not add a `packageManager` entry to the generated package.json file. Only works in conjunction with `generatePackageJson` option.                |         |
| `--sourcemap`                           | boolean | Generate source maps for production.                                                                                                                | `false` |

### `serve`

Serve a Remix app.

**Usage:**

```bash
nx run &lt;project&gt;:serve [options]
```

#### Options

| Option            | Type    | Description                                                                    | Default |
| ----------------- | ------- | ------------------------------------------------------------------------------ | ------- |
| `--command`       | string  | Command used to run your app server.                                           |         |
| `--debug`         | boolean | Attach a Node.js inspector.                                                    | `false` |
| `--devServerPort` | number  | Port to start the dev server on.                                               |         |
| `--manual`        | boolean | Enable manual mode                                                             | `false` |
| `--port`          | number  | Set PORT environment variable that can be used to serve the Remix application. | `4200`  |
| `--tlsCert`       | string  | Path to TLS certificate (cert.pem).                                            |         |
| `--tlsKey`        | string  | Path to TLS key (key.pem).                                                     |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
