---
title: '@nx/esbuild Executors'
description: 'Complete reference for all @nx/esbuild executor commands'
sidebar_label: Executors
---

# @nx/esbuild Executors

The @nx/esbuild plugin provides various executors to run tasks on your esbuild projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

## Available Executors

### `esbuild`

Bundle a package for different platforms.

**Usage:**

```bash
nx run &lt;project&gt;:esbuild [options]
```

#### Options

| Option                        | Type    | Description                                                                                                                                                                                                                                  | Default   |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--main` **[required]**       | string  | The path to the entry file, relative to project.                                                                                                                                                                                             |           |
| `--outputPath` **[required]** | string  | The output path of the generated files.                                                                                                                                                                                                      |           |
| `--tsConfig` **[required]**   | string  | The path to tsconfig file.                                                                                                                                                                                                                   |           |
| `--additionalEntryPoints`     | array   | List of additional entry points.                                                                                                                                                                                                             | `[]`      |
| `--assets`                    | array   | List of static assets.                                                                                                                                                                                                                       | `[]`      |
| `--bundle`                    | boolean | Whether to bundle the main entry point and additional entry points. Set to false to keep individual output files.                                                                                                                            | `true`    |
| `--declaration`               | boolean | Generate declaration (\*.d.ts) files for every TypeScript or JavaScript file inside your project. Should be used for libraries that are published to an npm repository.                                                                      |           |
| `--declarationRootDir`        | string  | Sets the rootDir for the declaration (\*.d.ts) files.                                                                                                                                                                                        |           |
| `--deleteOutputPath`          | boolean | Remove previous output before build.                                                                                                                                                                                                         | `true`    |
| `--esbuildConfig`             | string  | Path to a esbuild configuration file. See https://esbuild.github.io/api/. Cannot be used with 'esbuildOptions' option.                                                                                                                       |           |
| `--esbuildOptions`            | object  | Additional options to pass to esbuild. See https://esbuild.github.io/api/. Cannot be used with 'esbuildConfig' option.                                                                                                                       |           |
| `--external`                  | array   | Mark one or more module as external. Can use _ wildcards, such as '_.png'.                                                                                                                                                                   |           |
| `--format`                    | array   | List of module formats to output. Defaults to matching format from tsconfig (e.g. CJS for CommonJS, and ESM otherwise).                                                                                                                      | `["esm"]` |
| `--generatePackageJson`       | boolean | Generates a `package.json` and pruned lock file with the project's `node_module` dependencies populated for installing in a container. If a `package.json` exists in the project's directory, it will be reused with dependencies populated. | `false`   |
| `--metafile`                  | boolean | Generate a meta.json file in the output folder that includes metadata about the build. This file can be analyzed by other tools.                                                                                                             | `false`   |
| `--minify`                    | boolean | Minifies outputs.                                                                                                                                                                                                                            | `false`   |
| `--outputFileName`            | string  | Name of the main output file. Defaults same basename as 'main' file.                                                                                                                                                                         |           |
| `--outputHashing`             | string  | Define the output filename cache-busting hashing mode.                                                                                                                                                                                       | `none`    |
| `--platform`                  | string  | Platform target for outputs.                                                                                                                                                                                                                 | `node`    |
| `--skipTypeCheck`             | boolean | Skip type-checking via TypeScript. Skipping type-checking speeds up the build but type errors are not caught.                                                                                                                                | `false`   |
| `--sourcemap`                 | string  | Generate sourcemap.                                                                                                                                                                                                                          |           |
| `--target`                    | string  | The environment target for outputs.                                                                                                                                                                                                          | `esnext`  |
| `--thirdParty`                | boolean | Includes third-party packages in the bundle (i.e. npm packages).                                                                                                                                                                             |           |
| `--watch`                     | boolean | Enable re-building when files change.                                                                                                                                                                                                        | `false`   |

## Getting Help

You can get help for any executor by adding the `--help` flag:

```bash
nx run &lt;project&gt;:&lt;executor&gt; --help
```
