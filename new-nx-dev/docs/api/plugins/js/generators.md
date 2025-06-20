---
title: '@nx/js Generators'
description: 'Complete reference for all @nx/js generator commands'
sidebar_label: Generators
---

# @nx/js Generators

The @nx/js plugin provides various generators to help you create and configure js projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `convert-to-swc`

Convert a TSC library to SWC.

**Usage:**

```bash
nx generate @nx/js:convert-to-swc [options]
```

**Aliases:** `swc`

**Arguments:**

```bash
nx generate @nx/js:convert-to-swc &lt;project&gt; [options]
```

#### Options

| Option      | Type  | Description                 | Default     |
| ----------- | ----- | --------------------------- | ----------- |
| `--targets` | array | List of targets to convert. | `["build"]` |

### `library`

Create a TypeScript Library.

**Usage:**

```bash
nx generate @nx/js:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/js:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default   |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--buildable`               | boolean | Generate a buildable library.                                                                                                     | `true`    |
| `--bundler`                 | string  | The bundler to use. Choosing 'none' means this library is not buildable.                                                          | `tsc`     |
| `--compiler`                | string  | The compiler used by the build and test targets                                                                                   |           |
| `--config`                  | string  | Determines whether the project's executors should be configured in `workspace.json`, `project.json` or as npm scripts.            | `project` |
| `--importPath`              | string  | The library name used to import it, like @myorg/my-awesome-lib. Required for publishable library.                                 |           |
| `--includeBabelRc`          | boolean | Include a .babelrc configuration to compile TypeScript files                                                                      |           |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false`   |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          |           |
| `--minimal`                 | boolean | Generate a library with a minimal setup. No README.md generated.                                                                  | `false`   |
| `--name`                    | string  | Library name.                                                                                                                     |           |
| `--publishable`             | boolean | Configure the library ready for use with `nx release` (https://nx.dev/core-features/manage-releases).                             | `false`   |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false`   |
| `--simpleName`              | boolean | Don't include the directory in the generated file name.                                                                           | `false`   |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false`   |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false`   |
| `--skipTsConfig`            | boolean | Do not update tsconfig.json for development experience.                                                                           | `false`   |
| `--skipTypeCheck`           | boolean | Whether to skip TypeScript type checking for SWC compiler.                                                                        | `false`   |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                    | `true`    |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                       |           |
| `--testEnvironment`         | string  | The test environment to use if unitTestRunner is set to jest or vitest.                                                           | `node`    |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                |           |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |           |

### `setup-build`

Sets up build target for a project.

**Usage:**

```bash
nx generate @nx/js:setup-build [options]
```

**Arguments:**

```bash
nx generate @nx/js:setup-build &lt;project&gt; [options]
```

#### Options

| Option                     | Type   | Description                                                                                                                                                              | Default |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--bundler` **[required]** | string | The bundler to use to build the project.                                                                                                                                 | `tsc`   |
| `--buildTarget`            | string | The build target to add.                                                                                                                                                 | `build` |
| `--main`                   | string | The path to the main entry file, relative to workspace root. Defaults to &lt;project&gt;/src/index.ts or &lt;project&gt;/src/main.ts.                                    |         |
| `--tsConfig`               | string | The path to the tsConfig file, relative to workspace root. Defaults to &lt;project&gt;/tsconfig.lib.json or &lt;project&gt;/tsconfig.app.json depending on project type. |         |

### `setup-prettier`

Setup Prettier as the formatting tool.

**Usage:**

```bash
nx generate @nx/js:setup-prettier [options]
```

#### Options

| Option              | Type    | Description                                | Default |
| ------------------- | ------- | ------------------------------------------ | ------- |
| `--skipFormat`      | boolean | Skip formatting files.                     | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |

### `setup-verdaccio`

Setup Verdaccio local-registry.

**Usage:**

```bash
nx generate @nx/js:setup-verdaccio [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/js:<generator> --help
```
