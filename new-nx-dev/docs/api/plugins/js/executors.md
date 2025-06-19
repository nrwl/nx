---
title: '@nx/js Executors'
description: 'Complete reference for all @nx/js executor commands'
sidebar_label: Executors
---

# @nx/js Executors

The @nx/js plugin provides various executors to run tasks on your js projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `copy-workspace-modules`

Copies Workspace Modules into the output directory after a build to prepare it for use with Docker or alternatives.

**Usage:**

```bash
nx run &lt;project&gt;:copy-workspace-modules [options]
```

#### Options

| Option                         | Type   | Description                                                                         | Default |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------- | ------- |
| `--buildTarget` **[required]** | string | The build target that produces the output directory to transform.                   | `build` |
| `--outputPath`                 | string | The output path to transform. Usually inferred from the outputs of the buildTarget. |         |

### `node`

Execute Nodejs applications.

**Usage:**

```bash
nx run &lt;project&gt;:node [options]
```

#### Options

| Option                         | Type    | Description                                                                                                                                                                                | Default     |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `--buildTarget` **[required]** | string  | The target to run to build you the app.                                                                                                                                                    |             |
| `--args`                       | array   | Extra args when starting the app.                                                                                                                                                          | `[]`        |
| `--buildTargetOptions`         | object  | Additional options to pass into the build target.                                                                                                                                          | `{}`        |
| `--debounce`                   | number  | Delay in milliseconds to wait before restarting. Useful to batch multiple file changes events together. Set to zero (0) to disable.                                                        | `500`       |
| `--host`                       | string  | The host to inspect the process on.                                                                                                                                                        | `localhost` |
| `--inspect`                    | string  | Ensures the app is starting with debugging.                                                                                                                                                | `inspect`   |
| `--port`                       | number  | The port to inspect the process on. Setting port to 0 will assign random free ports to all forked processes.                                                                               | `9229`      |
| `--runBuildTargetDependencies` | boolean | Whether to run dependencies before running the build. Set this to true if the project does not build libraries from source (e.g. 'buildLibsFromSource: false').                            | `false`     |
| `--runtimeArgs`                | array   | Extra args passed to the node process.                                                                                                                                                     | `[]`        |
| `--waitUntilTargets`           | array   | The targets to run before starting the node app. Listed in the form &lt;project&gt;:&lt;target&gt;. The main target will run once all listed targets have output something to the console. | `[]`        |
| `--watch`                      | boolean | Enable re-building when files change.                                                                                                                                                      | `true`      |

### `swc`

Builds using SWC.

**Usage:**

```bash
nx run &lt;project&gt;:swc [options]
```

#### Options

| Option                        | Type    | Description                                                                                                        | Default                                                                                                     |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `--main` **[required]**       | string  | The name of the main entry-point file.                                                                             |                                                                                                             |
| `--outputPath` **[required]** | string  | The output path of the generated files.                                                                            |                                                                                                             |
| `--tsConfig` **[required]**   | string  | The path to the Typescript configuration file.                                                                     |                                                                                                             |
| `--additionalEntryPoints`     | array   | Additional entry-points to add to exports field in the package.json file.                                          |                                                                                                             |
| `--assets`                    | array   | List of static assets.                                                                                             | `[]`                                                                                                        |
| `--clean`                     | boolean | Remove previous output before build.                                                                               | `true`                                                                                                      |
| `--external`                  | string  | A list projects to be treated as external. This feature is experimental                                            |                                                                                                             |
| `--externalBuildTargets`      | array   | List of target names that annotate a build target for a project                                                    | `["build"]`                                                                                                 |
| `--generateExportsField`      | boolean | Update the output package.json file's 'exports' field. This field is used by Node and bundles.                     | `false`                                                                                                     |
| `--generateLockfile`          | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match. | `false`                                                                                                     |
| `--skipTypeCheck`             | boolean | Whether to skip TypeScript type checking.                                                                          | `false`                                                                                                     |
| `--stripLeadingPaths`         | boolean | Remove leading directory from output (e.g. src). See: https://swc.rs/docs/usage/cli#--strip-leading-paths          | `false`                                                                                                     |
| `--swcExclude`                | array   | List of SWC Glob/Regex to be excluded from compilation (https://swc.rs/docs/configuration/compilation#exclude).    | `["./src/**/.*.spec.ts$","./**/.*.spec.ts$","./src/**/jest-setup.ts$","./**/jest-setup.ts$","./**/.*.js$"]` |
| `--swcrc`                     | string  | The path to the SWC configuration file. Default: .swcrc                                                            |                                                                                                             |
| `--watch`                     | boolean | Enable re-building when files change.                                                                              | `false`                                                                                                     |

### `tsc`

Builds using TypeScript.

**Usage:**

```bash
nx run &lt;project&gt;:tsc [options]
```

#### Options

| Option                        | Type    | Description                                                                                                                                                              | Default     |
| ----------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `--main` **[required]**       | string  | The name of the main entry-point file.                                                                                                                                   |             |
| `--outputPath` **[required]** | string  | The output path of the generated files.                                                                                                                                  |             |
| `--tsConfig` **[required]**   | string  | The path to the Typescript configuration file.                                                                                                                           |             |
| `--additionalEntryPoints`     | array   | Additional entry-points to add to exports field in the package.json file. Ignored when `generatePackageJson` is set to `false`.                                          |             |
| `--assets`                    | array   | List of static assets.                                                                                                                                                   | `[]`        |
| `--clean`                     | boolean | Remove previous output before build.                                                                                                                                     | `true`      |
| `--external`                  | string  | A list projects to be treated as external. This feature is experimental                                                                                                  |             |
| `--externalBuildTargets`      | array   | List of target names that annotate a build target for a project                                                                                                          | `["build"]` |
| `--generateExportsField`      | boolean | Update the output package.json file's 'exports' field. This field is used by Node and bundlers. Ignored when `generatePackageJson` is set to `false`.                    | `false`     |
| `--generateLockfile`          | boolean | Generate a lockfile (e.g. package-lock.json) that matches the workspace lockfile to ensure package versions match. Ignored when `generatePackageJson` is set to `false`. | `false`     |
| `--generatePackageJson`       | boolean | Generate package.json file in the output folder.                                                                                                                         | `true`      |
| `--outputFileName`            | string  | The path to the main file relative to the outputPath                                                                                                                     |             |
| `--rootDir`                   | string  | Sets the rootDir for TypeScript compilation. When not defined, it uses the root of project.                                                                              |             |
| `--transformers`              | array   | List of TypeScript Transformer Plugins.                                                                                                                                  | `[]`        |
| `--watch`                     | boolean | Enable re-building when files change.                                                                                                                                    | `false`     |

### `verdaccio`

Start a local registry with Verdaccio.

**Usage:**

```bash
nx run &lt;project&gt;:verdaccio [options]
```

#### Options

| Option                  | Type    | Description                                            | Default     |
| ----------------------- | ------- | ------------------------------------------------------ | ----------- |
| `--port` **[required]** | number  | Port of local registry that Verdaccio should listen to |             |
| `--clear`               | boolean | Clear local registry storage before starting Verdaccio | `true`      |
| `--config`              | string  | Path to the custom Verdaccio config file               |             |
| `--listenAddress`       | string  | Listen address that Verdaccio should listen to         | `localhost` |
| `--location`            | string  | Location option for npm config                         | `user`      |
| `--scopes`              | array   | Scopes to be added to the Verdaccio config             |             |
| `--storage`             | string  | Path to the custom storage directory for Verdaccio     |             |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
