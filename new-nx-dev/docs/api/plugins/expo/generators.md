---
title: '@nx/expo Generators'
description: 'Complete reference for all @nx/expo generator commands'
sidebar_label: Generators
---

# @nx/expo Generators

The @nx/expo plugin provides various generators to help you create and configure expo projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Create an Expo Application for Nx.

**Usage:**

```bash
nx generate @nx/expo:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/expo:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--displayName`             | string  | The display name to show in the application. Defaults to name.                                                                    |         |
| `--e2eTestRunner`           | string  | Adds the specified e2e test runner                                                                                                | `none`  |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files                                                                            | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`  |
| `--name`                    | string  | The name of the application.                                                                                                      |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat`              | boolean | Skip formatting files                                                                                                             | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false` |
| `--standaloneConfig`        | boolean | Split the project configuration into `&lt;projectRoot&gt;/project.json` rather than including it inside `workspace.json`.         | `true`  |
| `--tags`                    | string  | Add tags to the application (used for linting)                                                                                    |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests                                                                                                 | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |         |

### `component`

Create a Expo Component for Nx.

**Usage:**

```bash
nx generate @nx/expo:component [options]
```

**Aliases:** `c`

**Arguments:**

```bash
nx generate @nx/expo:component &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                                                                    | Default |
| ------------------ | ------- | ------------------------------------------------------------------------------ | ------- |
| `--classComponent` | boolean | Use class components instead of functional component.                          | `false` |
| `--export`         | boolean | When true, the component is exported from the project index.ts (if it exists). | `false` |
| `--js`             | boolean | Generate JavaScript files rather than TypeScript files.                        |         |
| `--name`           | string  | The component symbol name. Defaults to the last segment of the file path.      |         |
| `--skipFormat`     | boolean | Skip formatting files.                                                         | `false` |
| `--skipTests`      | boolean | When true, does not create "spec.ts" test files for the new component.         | `false` |

### `convert-to-inferred`

Convert existing Expo project(s) using `@nx/expo:*` executors to use `@nx/expo/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/expo:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                            | Default |
| -------------- | ------- | -------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/expo:*` executors to use `@nx/expo/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                   | `false` |

### `library`

Create a Expo Library for Nx.

**Usage:**

```bash
nx generate @nx/expo:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/expo:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildable`               | boolean | Generate a buildable library.                                                                                                     | `false` |
| `--importPath`              | string  | The library name used to import it, like @myorg/my-awesome-lib                                                                    |         |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`  |
| `--name`                    | string  | Library name                                                                                                                      |         |
| `--publishable`             | boolean | Create a publishable library.                                                                                                     |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false` |
| `--skipTsConfig`            | boolean | Do not update tsconfig.json for development experience.                                                                           | `false` |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                    | `true`  |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                       |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |         |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/expo:<generator> --help
```
