---
title: '@nx/web Generators'
description: 'Complete reference for all @nx/web generator commands'
sidebar_label: Generators
---

# @nx/web Generators

The @nx/web plugin provides various generators to help you create and configure web projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Create a web application using `swc` or `babel` as compiler.

**Usage:**

```bash
nx generate @nx/web:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/web:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                            | Default      |
| --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| `--bundler`                 | string  | The bundler to use.                                                                                                                                    | `vite`       |
| `--compiler`                | string  | The compiler to use                                                                                                                                    | `swc`        |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (e2e) tests                                                                                                          | `playwright` |
| `--inSourceTests`           | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files.                                     | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                               | `none`       |
| `--name`                    | string  | The name of the application.                                                                                                                           |              |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                      | `false`      |
| `--skipFormat`              | boolean | Skip formatting files                                                                                                                                  | `false`      |
| `--strict`                  | boolean | Creates an application with strict mode and strict type checking.                                                                                      | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                                         | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting)                                                                                                         |              |
| `--unitTestRunner`          | string  | Test runner to use for unit tests. Default value is 'jest' when using 'webpack' or 'none' as the bundler and 'vitest' when using 'vite' as the bundler | `none`       |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                                           |              |

### `static-config`

Add a new serve target to serve a build apps static files. This allows for faster serving of the static build files by reusing the case. Helpful when reserving the app over and over again like in e2e tests.

**Usage:**

```bash
nx generate @nx/web:static-config [options]
```

#### Options

| Option                         | Type    | Description                                                                                                                 | Default        |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `--buildTarget` **[required]** | string  | Name of the build target to serve                                                                                           |                |
| `--outputPath`                 | string  | Path to the directory of the built files. This is only needed if buildTarget doesn't specify an outputPath executor option. |                |
| `--spa`                        | boolean | Whether to set the 'spa' flag on the generated target.                                                                      | `true`         |
| `--targetName`                 | string  | Name of the serve target to add. Defaults to 'serve-static'.                                                                | `serve-static` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/web:<generator> --help
```
