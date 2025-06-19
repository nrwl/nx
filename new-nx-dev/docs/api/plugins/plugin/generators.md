---
title: '@nx/plugin Generators'
description: 'Complete reference for all @nx/plugin generator commands'
sidebar_label: Generators
---

# @nx/plugin Generators

The @nx/plugin plugin provides various generators to help you create and configure plugin projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `create-package`

Create a framework package that uses Nx CLI.

**Usage:**

```bash
nx generate @nx/plugin:create-package [options]
```

**Arguments:**

```bash
nx generate @nx/plugin:create-package &lt;directory&gt; [options]
```

#### Options

| Option                     | Type    | Description                                                                                                   | Default |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- | ------- |
| `--name` **[required]**    | string  | The package name of cli, e.g. `create-framework-package`. Note this must be a valid NPM name to be published. |         |
| `--project` **[required]** | string  | The name of the generator project.                                                                            |         |
| `--compiler`               | string  | The compiler used by the build and test targets.                                                              | `tsc`   |
| `--e2eProject`             | string  | The name of the e2e project.                                                                                  |         |
| `--linter`                 | string  | The tool to use for running lint checks.                                                                      |         |
| `--skipFormat`             | boolean | Skip formatting files.                                                                                        | `false` |
| `--tags`                   | string  | Add tags to the library (used for linting).                                                                   |         |
| `--unitTestRunner`         | string  | Test runner to use for unit tests.                                                                            |         |
| `--useProjectJson`         | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.  |         |

### `e2e-project`

Create an E2E app for a Nx Plugin.

**Usage:**

```bash
nx generate @nx/plugin:e2e-project [options]
```

#### Options

| Option                            | Type    | Description                                                                                                                  | Default |
| --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--npmPackageName` **[required]** | string  | the package name of the plugin as it would be published to NPM.                                                              |         |
| `--pluginName` **[required]**     | string  | the project name of the plugin to be tested.                                                                                 |         |
| `--jestConfig`                    | string  | Jest config file.                                                                                                            |         |
| `--linter`                        | string  | The tool to use for running lint checks.                                                                                     |         |
| `--minimal`                       | boolean | Generate the e2e project with a minimal setup. This would involve not generating tests for a default executor and generator. | `false` |
| `--pluginOutputPath`              | string  | the output path of the plugin after it builds.                                                                               |         |
| `--projectDirectory`              | string  | the directory where the plugin is placed.                                                                                    |         |
| `--skipFormat`                    | boolean | Skip formatting files.                                                                                                       | `false` |
| `--useProjectJson`                | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                 |         |

### `executor`

Create an Executor for an Nx Plugin.

**Usage:**

```bash
nx generate @nx/plugin:executor [options]
```

**Arguments:**

```bash
nx generate @nx/plugin:executor &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                                                     | Default |
| ------------------ | ------- | --------------------------------------------------------------- | ------- |
| `--description`    | string  | Executor description.                                           |         |
| `--includeHasher`  | boolean | Should the boilerplate for a custom hasher be generated?        | `false` |
| `--name`           | string  | The executor name to export in the plugin executors collection. |         |
| `--skipFormat`     | boolean | Skip formatting files.                                          | `false` |
| `--skipLintChecks` | boolean | Do not add an eslint configuration for plugin json files.       | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests.                              | `jest`  |

### `generator`

Create a Generator for an Nx Plugin.

**Usage:**

```bash
nx generate @nx/plugin:generator [options]
```

**Arguments:**

```bash
nx generate @nx/plugin:generator &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                                                       | Default |
| ------------------ | ------- | ----------------------------------------------------------------- | ------- |
| `--description`    | string  | Generator description.                                            |         |
| `--name`           | string  | The generator name to export in the plugin generators collection. |         |
| `--skipFormat`     | boolean | Do not format files with prettier.                                | `false` |
| `--skipLintChecks` | boolean | Do not add an eslint configuration for plugin json files.         | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests.                                | `jest`  |

### `migration`

Create a Migration for an Nx Plugin.

**Usage:**

```bash
nx generate @nx/plugin:migration [options]
```

**Arguments:**

```bash
nx generate @nx/plugin:migration &lt;path&gt; [options]
```

#### Options

| Option                            | Type    | Description                                                       | Default |
| --------------------------------- | ------- | ----------------------------------------------------------------- | ------- |
| `--packageVersion` **[required]** | string  | Version to use for the migration.                                 |         |
| `--description`                   | string  | Migration description.                                            |         |
| `--name`                          | string  | The migration name to export in the plugin migrations collection. |         |
| `--packageJsonUpdates`            | boolean | Whether or not to include `package.json` updates.                 | `false` |
| `--skipLintChecks`                | boolean | Do not eslint configuration for plugin json files.                | `false` |

### `plugin`

Create a Plugin for Nx.

**Usage:**

```bash
nx generate @nx/plugin:plugin [options]
```

**Arguments:**

```bash
nx generate @nx/plugin:plugin &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--compiler`                | string  | The compiler used by the build and test targets.                                                                                  | `tsc`   |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                    | `none`  |
| `--importPath`              | string  | How the plugin will be published, like `@myorg/my-awesome-plugin`. Note this must be a valid NPM name.                            |         |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          |         |
| `--name`                    | string  | Plugin name                                                                                                                       |         |
| `--publishable`             | boolean | Generates a boilerplate for publishing the plugin to npm.                                                                         | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false` |
| `--skipLintChecks`          | boolean | Do not eslint configuration for plugin json files.                                                                                | `false` |
| `--skipTsConfig`            | boolean | Do not update tsconfig.json for development experience.                                                                           | `false` |
| `--standaloneConfig`        | boolean | Split the project configuration into `&lt;projectRoot&gt;/project.json` rather than including it inside `workspace.json`.         | `true`  |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                       |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                |         |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |         |

### `plugin-lint-checks`

Adds linting configuration to validate common json files for nx plugins.

**Usage:**

```bash
nx generate @nx/plugin:plugin-lint-checks [options]
```

#### Options

| Option                         | Type    | Description                                            | Default |
| ------------------------------ | ------- | ------------------------------------------------------ | ------- |
| `--projectName` **[required]** | string  | Which project should be the configuration be added to? |         |
| `--skipFormat`                 | boolean | Skip formatting files with prettier.                   | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/plugin:<generator> --help
```
