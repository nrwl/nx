---
title: '@nx/node Generators'
description: 'Complete reference for all @nx/node generator commands'
sidebar_label: Generators
---

# @nx/node Generators

The @nx/node plugin provides various generators to help you create and configure node projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Nx Application Options Schema.

**Usage:**

```bash
nx generate @nx/node:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/node:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default   |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--babelJest`               | boolean | Use `babel` instead `ts-jest`.                                                                                                    | `false`   |
| `--bundler`                 | string  | Bundler which is used to package the application                                                                                  | `esbuild` |
| `--docker`                  | boolean | Add a docker build target                                                                                                         |           |
| `--e2eTestRunner`           | string  | Test runner to use for end-to-end tests                                                                                           | `none`    |
| `--framework`               | string  | Generate the node application using a framework                                                                                   | `none`    |
| `--frontendProject`         | string  | Frontend project that needs to access this application. This sets up proxy configuration.                                         |           |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false`   |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`    |
| `--name`                    | string  | The name of the application.                                                                                                      |           |
| `--port`                    | number  | The port which the server will be run on                                                                                          | `3000`    |
| `--rootProject`             | boolean | Create node application at the root of the workspace                                                                              | `false`   |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false`   |
| `--skipFormat`              | boolean | Skip formatting files                                                                                                             | `false`   |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false`   |
| `--standaloneConfig`        | boolean | Split the project configuration into `&lt;projectRoot&gt;/project.json` rather than including it inside `workspace.json`.         | `true`    |
| `--swcJest`                 | boolean | Use `@swc/jest` instead `ts-jest` for faster test compilation.                                                                    |           |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                   |           |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`    |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |           |

### `library`

Create a Node Library for an Nx workspace.

**Usage:**

```bash
nx generate @nx/node:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/node:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                            | Default |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--babelJest`               | boolean | Use `babel` instead of `ts-jest`.                                                                                                                      | `false` |
| `--buildable`               | boolean | Generate a buildable library.                                                                                                                          | `true`  |
| `--compiler`                | string  | The compiler used by the build and test targets.                                                                                                       | `tsc`   |
| `--importPath`              | string  | The library name used to import it, like `@myorg/my-awesome-lib`. Must be a valid npm name.                                                            |         |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                                                | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                               | `none`  |
| `--name`                    | string  | Library name                                                                                                                                           |         |
| `--publishable`             | boolean | Create a publishable library.                                                                                                                          |         |
| `--rootDir`                 | string  | Sets the `rootDir` for TypeScript compilation. When not defined, it uses the project's root property, or `srcRootForCompilationRoot` if it is defined. |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project`. We do not do this by default for lint performance reasons.                             | `false` |
| `--simpleModuleName`        | boolean | Keep the module name simple.                                                                                                                           | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                 | `false` |
| `--skipTsConfig`            | boolean | Do not update `tsconfig.base.json` for development experience.                                                                                         | `false` |
| `--standaloneConfig`        | boolean | Split the project configuration into `&lt;projectRoot&gt;/project.json` rather than including it inside `workspace.json`.                              | `true`  |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                                         | `false` |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                                            |         |
| `--testEnvironment`         | string  | The test environment to use if `unitTestRunner` is set to `jest`.                                                                                      | `jsdom` |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                     | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                                           |         |

### `setup-docker`

Nx Node Docker Options Schema.

**Usage:**

```bash
nx generate @nx/node:setup-docker [options]
```

#### Options

| Option              | Type   | Description                              | Default        |
| ------------------- | ------ | ---------------------------------------- | -------------- |
| `--buildTargetName` | string | The name of the build target             | `build`        |
| `--outputPath`      | string | The output path for the node application |                |
| `--project`         | string | The name of the project                  |                |
| `--targetName`      | string | The name of the target to create         | `docker-build` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/node:<generator> --help
```
