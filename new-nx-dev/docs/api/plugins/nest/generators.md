---
title: '@nx/nest Generators'
description: 'Complete reference for all @nx/nest generator commands'
sidebar_label: Generators
---

# @nx/nest Generators

The @nx/nest plugin provides various generators to help you create and configure nest projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Nx Application Options Schema.

**Usage:**

```bash
nx generate @nx/nest:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/nest:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                             | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (e2e) tests                                                                                           | `jest`  |
| `--frontendProject`         | string  | Frontend project that needs to access this application. This sets up proxy configuration.                                               |         |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                | `none`  |
| `--name`                    | string  | The name of the application.                                                                                                            |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.       | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                  | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                              | `false` |
| `--standaloneConfig`        | boolean | Split the project configuration into `&lt;projectRoot&gt;/project.json` rather than including it inside `workspace.json`.               | `true`  |
| `--strict`                  | boolean | Adds strictNullChecks, noImplicitAny, strictBindCallApply, forceConsistentCasingInFileNames and noFallthroughCasesInSwitch to tsconfig. | `false` |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                         |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                      | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                            |         |

### `class`

Nest Class Options Schema.

**Usage:**

```bash
nx generate @nx/nest:class [options]
```

**Arguments:**

```bash
nx generate @nx/nest:class &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest class language.               |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `controller`

Nest Controller Options Schema.

**Usage:**

```bash
nx generate @nx/nest:controller [options]
```

**Arguments:**

```bash
nx generate @nx/nest:controller &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                                   | Default |
| ------------------ | ------- | --------------------------------------------- | ------- |
| `--language`       | string  | Nest controller language.                     |         |
| `--module`         | string  | Allows specification of the declaring module. |         |
| `--skipFormat`     | boolean | Skip formatting files.                        | `false` |
| `--skipImport`     | boolean | Flag to skip the module import.               | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests.            | `jest`  |

### `decorator`

Nest Decorator Options Schema.

**Usage:**

```bash
nx generate @nx/nest:decorator [options]
```

**Arguments:**

```bash
nx generate @nx/nest:decorator &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description              | Default |
| -------------- | ------- | ------------------------ | ------- |
| `--language`   | string  | Nest decorator language. |         |
| `--skipFormat` | boolean | Skip formatting files.   | `false` |

### `filter`

Nest Filter Options Schema.

**Usage:**

```bash
nx generate @nx/nest:filter [options]
```

**Arguments:**

```bash
nx generate @nx/nest:filter &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest filter language.              |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `gateway`

Nest Gateway Options Schema.

**Usage:**

```bash
nx generate @nx/nest:gateway [options]
```

**Arguments:**

```bash
nx generate @nx/nest:gateway &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest gateway language.             |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `guard`

Nest Guard Options Schema.

**Usage:**

```bash
nx generate @nx/nest:guard [options]
```

**Arguments:**

```bash
nx generate @nx/nest:guard &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest guard language.               |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `interceptor`

Nest Interceptor Options Schema.

**Usage:**

```bash
nx generate @nx/nest:interceptor [options]
```

**Arguments:**

```bash
nx generate @nx/nest:interceptor &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest interceptor language.         |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `interface`

Nest Interface Options Schema.

**Usage:**

```bash
nx generate @nx/nest:interface [options]
```

**Arguments:**

```bash
nx generate @nx/nest:interface &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

### `library`

Create a NestJS Library for Nx.

**Usage:**

```bash
nx generate @nx/nest:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/nest:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default  |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--buildable`               | boolean | Generate a buildable library.                                                                                                     | `false`  |
| `--controller`              | boolean | Include a controller with the library.                                                                                            | `false`  |
| `--global`                  | boolean | Add the Global decorator to the generated module.                                                                                 | `false`  |
| `--importPath`              | string  | The library name used to import it, like @myorg/my-awesome-lib. Must be a valid npm name.                                         |          |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`   |
| `--name`                    | string  | Library name.                                                                                                                     |          |
| `--publishable`             | boolean | Create a publishable library.                                                                                                     |          |
| `--service`                 | boolean | Include a service with the library.                                                                                               | `false`  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons. | `false`  |
| `--simpleName`              | boolean | Don't include the directory in the name of the module of the library.                                                             | `false`  |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false`  |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false`  |
| `--skipTsConfig`            | boolean | Do not update tsconfig.base.json for development experience.                                                                      | `false`  |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                    | `true`   |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                       |          |
| `--target`                  | string  | The ES target, Nest suggest using es2021 or higher.                                                                               | `es2021` |
| `--testEnvironment`         | string  | The test environment for jest, for node applications this should stay as node unless doing DOM testing.                           | `node`   |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`   |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |          |

### `middleware`

Nest Middleware Options Schema.

**Usage:**

```bash
nx generate @nx/nest:middleware [options]
```

**Arguments:**

```bash
nx generate @nx/nest:middleware &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest middleware language.          |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `module`

Nest Module Options Schema.

**Usage:**

```bash
nx generate @nx/nest:module [options]
```

**Arguments:**

```bash
nx generate @nx/nest:module &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                     | Default |
| -------------- | ------- | ------------------------------- | ------- |
| `--language`   | string  | Nest module language.           |         |
| `--module`     | string  | The path to import the module.  |         |
| `--skipFormat` | boolean | Skip formatting files.          | `false` |
| `--skipImport` | boolean | Flag to skip the module import. | `false` |

### `pipe`

Nest Pipe Options Schema.

**Usage:**

```bash
nx generate @nx/nest:pipe [options]
```

**Arguments:**

```bash
nx generate @nx/nest:pipe &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest pipe language.                |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `provider`

Nest Provider Options Schema.

**Usage:**

```bash
nx generate @nx/nest:provider [options]
```

**Arguments:**

```bash
nx generate @nx/nest:provider &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest provider language.            |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `resolver`

Nest Resolver Options Schema.

**Usage:**

```bash
nx generate @nx/nest:resolver [options]
```

**Arguments:**

```bash
nx generate @nx/nest:resolver &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest resolver language.            |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

### `resource`

Nest Resource Options Schema.

**Usage:**

```bash
nx generate @nx/nest:resource [options]
```

**Arguments:**

```bash
nx generate @nx/nest:resource &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                                 | Default |
| ------------------ | ------- | ------------------------------------------- | ------- |
| `--crud`           | boolean | When true, CRUD entry points are generated. | `true`  |
| `--skipFormat`     | boolean | Skip formatting files.                      | `false` |
| `--skipImport`     | boolean | Flag to skip the module import.             | `false` |
| `--type`           | string  | The transport layer.                        | `rest`  |
| `--unitTestRunner` | string  | Test runner to use for unit tests.          | `jest`  |

### `service`

Nest Service Options Schema.

**Usage:**

```bash
nx generate @nx/nest:service [options]
```

**Arguments:**

```bash
nx generate @nx/nest:service &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                        | Default |
| ------------------ | ------- | ---------------------------------- | ------- |
| `--language`       | string  | Nest service language.             |         |
| `--skipFormat`     | boolean | Skip formatting files.             | `false` |
| `--unitTestRunner` | string  | Test runner to use for unit tests. | `jest`  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/nest:<generator> --help
```
