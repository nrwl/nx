---
title: '@nx/next Generators'
description: 'Complete reference for all @nx/next generator commands'
sidebar_label: Generators
---

# @nx/next Generators

The @nx/next plugin provides various generators to help you create and configure next projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Create a Next.js Application for Nx.

**Usage:**

```bash
nx generate @nx/next:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/next:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default      |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--appDir`                  | boolean | Enable the App Router for this project.                                                                                           | `true`       |
| `--customServer`            | boolean | Use a custom Express server for the Next.js application.                                                                          | `false`      |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                    | `playwright` |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`       |
| `--name`                    | string  | The name of the application.                                                                                                      |              |
| `--rootProject`             | boolean | Create an application at the root of the workspace.                                                                               | `false`      |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false`      |
| `--src`                     | boolean | Generate a `src` directory for the project.                                                                                       | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                    | `css`        |
| `--swc`                     | boolean | Enable the Rust-based compiler SWC to compile JS/TS files.                                                                        | `true`       |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                   |              |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`       |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |              |

### `component`

Create a React Component for Next.

**Usage:**

```bash
nx generate @nx/next:component [options]
```

**Arguments:**

```bash
nx generate @nx/next:component &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                                                                    | Default |
| -------------- | ------- | ------------------------------------------------------------------------------ | ------- |
| `--export`     | boolean | When true, the component is exported from the project index.ts (if it exists). | `false` |
| `--js`         | boolean | Generate JavaScript files rather than TypeScript files.                        |         |
| `--name`       | string  | The component symbol name. Defaults to the last segment of the file path.      |         |
| `--skipFormat` | boolean | Skip formatting files.                                                         | `false` |
| `--skipTests`  | boolean | When true, does not create `spec.ts` test files for the new component.         | `false` |
| `--style`      | string  | The file extension to be used for style files.                                 | `css`   |

### `convert-to-inferred`

Convert existing Next.js project(s) using `@nx/next:build` executor to use `@nx/next/plugin`.

**Usage:**

```bash
nx generate @nx/next:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                                                                                                                    | Default |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--project`    | string  | The project to convert from using the `@nx/next:build` executor to use `@nx/next/plugin`. If not provided, all projects using the `@nx/next:build` executor will be converted. |         |
| `--skipFormat` | boolean | Whether to format files.                                                                                                                                                       | `false` |

### `custom-server`

Add a custom server to existing Next.js application.

**Usage:**

```bash
nx generate @nx/next:custom-server [options]
```

**Arguments:**

```bash
nx generate @nx/next:custom-server &lt;project&gt; [options]
```

#### Options

| Option       | Type   | Description                                   | Default |
| ------------ | ------ | --------------------------------------------- | ------- |
| `--compiler` | string | The compiler used to build the custom server. | `tsc`   |

### `cypress-component-configuration`

Add Cypress Componet Testing to an existing NextJS project.

**Usage:**

```bash
nx generate @nx/next:cypress-component-configuration [options]
```

#### Options

| Option                     | Type    | Description                                                               | Default |
| -------------------------- | ------- | ------------------------------------------------------------------------- | ------- |
| `--project` **[required]** | string  | The name of the project to add cypress component testing configuration to |         |
| `--generateTests`          | boolean | Generate default component tests for existing components in the project   | `false` |
| `--skipFormat`             | boolean | Skip formatting files                                                     | `false` |

### `library`

Create a React Library for an Nx workspace.

**Usage:**

```bash
nx generate @nx/next:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/next:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--appProject`              | string  | The application project to add the library route to.                                                                              |         |
| `--buildable`               | boolean | Generate a buildable library that uses rollup to bundle.                                                                          | `false` |
| `--bundler`                 | string  | The bundler to use. Choosing 'none' means this library is not buildable.                                                          | `none`  |
| `--component`               | boolean | Generate a default component.                                                                                                     | `true`  |
| `--globalCss`               | boolean | When true, the stylesheet is generated using global CSS instead of CSS modules (e.g. file is `*.css` rather than `*.module.css`). | `false` |
| `--importPath`              | string  | The library name used to import it, like `@myorg/my-awesome-lib`.                                                                 |         |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`  |
| `--name`                    | string  | Library name                                                                                                                      |         |
| `--publishable`             | boolean | Create a publishable library.                                                                                                     |         |
| `--routing`                 | boolean | Generate library with routes.                                                                                                     |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false` |
| `--skipTsConfig`            | boolean | Do not update tsconfig.json for development experience.                                                                           | `false` |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                    | `true`  |
| `--style`                   | string  | The file extension to be used for style files.                                                                                    | `css`   |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                       |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |         |

### `page`

Create a Page for Next.

**Usage:**

```bash
nx generate @nx/next:page [options]
```

**Arguments:**

```bash
nx generate @nx/next:page &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                                                                      | Default |
| -------------- | ------- | -------------------------------------------------------------------------------- | ------- |
| `--export`     | boolean | When true, the component is exported from the project `index.ts` (if it exists). | `false` |
| `--js`         | boolean | Generate JavaScript files rather than TypeScript files.                          | `false` |
| `--name`       | string  | The page symbol name. Defaults to the page directory name.                       |         |
| `--skipFormat` | boolean | Skip formatting files.                                                           | `false` |
| `--style`      | string  | The file extension to be used for style files.                                   | `css`   |
| `--withTests`  | boolean | When true, creates a `spec.ts` test file for the new page.                       | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/next:<generator> --help
```
