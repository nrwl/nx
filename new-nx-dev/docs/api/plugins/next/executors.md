---
title: '@nx/next Executors'
description: 'Complete reference for all @nx/next executor commands'
sidebar_label: Executors
---

# @nx/next Executors

The @nx/next plugin provides various executors to run tasks on your next projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `build`

Build a Next.js app.

**Usage:**

```bash
nx run &lt;project&gt;:build [options]
```

#### Options

| Option                                  | Type    | Description                                                                                                                                                                                                                                    | Default |
| --------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--outputPath` **[required]**           | string  | The output path of the generated files.                                                                                                                                                                                                        |         |
| `--buildLibsFromSource`                 | boolean | Read buildable libraries from source instead of building them separately.                                                                                                                                                                      | `true`  |
| `--debug`                               | boolean | Enable Next.js debug build logging                                                                                                                                                                                                             |         |
| `--experimentalAppOnly`                 | boolean | Only build 'app' routes                                                                                                                                                                                                                        |         |
| `--experimentalBuildMode`               | string  | Change the build mode.                                                                                                                                                                                                                         |         |
| `--fileReplacements`                    | array   | Replace files with other files in the build.                                                                                                                                                                                                   | `[]`    |
| `--generateLockfile`                    | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match.                                                                                                                             | `false` |
| `--includeDevDependenciesInPackageJson` | boolean | Include `devDependencies` in the generated package.json file. By default only production `dependencies` are included.                                                                                                                          | `false` |
| `--nextConfig`                          | string  | Path (relative to workspace root) to a function which takes phase, config, and builder options, and returns the resulting config. This is an advanced option and should not be used with a normal Next.js config file (i.e. `next.config.js`). |         |
| `--profile`                             | boolean | Used to enable React Production Profiling                                                                                                                                                                                                      |         |
| `--skipOverrides`                       | boolean | Do not add a `overrides` and `resolutions` entries to the generated package.json file. Only works in conjunction with `generatePackageJson` option.                                                                                            |         |
| `--skipPackageManager`                  | boolean | Do not add a `packageManager` entry to the generated package.json file.                                                                                                                                                                        |         |

### `server`

Serve a Next.js app.

**Usage:**

```bash
nx run &lt;project&gt;:server [options]
```

#### Options

| Option                         | Type    | Description                                                                                                                                         | Default |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildTarget` **[required]** | string  | Target which builds the application.                                                                                                                |         |
| `--buildLibsFromSource`        | boolean | Read buildable libraries from source instead of building them separately.                                                                           | `true`  |
| `--customServerHttps:`         | boolean | Enable HTTPS support for the custom server.                                                                                                         |         |
| `--customServerTarget`         | string  | Target which builds the custom server.                                                                                                              |         |
| `--dev`                        | boolean | Serve the application in the dev mode.                                                                                                              | `true`  |
| `--experimentalHttps`          | boolean | Enable HTTPS support for the Next.js development server.                                                                                            |         |
| `--experimentalHttpsCa`        | string  | Path to a HTTPS certificate authority file.                                                                                                         |         |
| `--experimentalHttpsCert`      | string  | Path to a HTTPS certificate file.                                                                                                                   |         |
| `--experimentalHttpsKey`       | string  | Path to a HTTPS key file.                                                                                                                           |         |
| `--hostname`                   | string  | Hostname on which the application is served.                                                                                                        |         |
| `--keepAliveTimeout`           | number  | Max milliseconds to wait before closing inactive connection.                                                                                        |         |
| `--port`                       | number  | Port to listen on.                                                                                                                                  | `4200`  |
| `--quiet`                      | boolean | Hide error messages containing server information.                                                                                                  | `false` |
| `--staticMarkup`               | boolean | Static markup.                                                                                                                                      | `false` |
| `--turbo`                      | boolean | Activate the incremental bundler for Next.js, which is implemented in Rust. Please note, this feature is exclusively available in development mode. |         |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
