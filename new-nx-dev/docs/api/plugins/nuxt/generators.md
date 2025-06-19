---
title: '@nx/nuxt Generators'
description: 'Complete reference for all @nx/nuxt generator commands'
sidebar_label: Generators
---

# @nx/nuxt Generators

The @nx/nuxt plugin provides various generators to help you create and configure nuxt projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Create a Nuxt Application for Nx.

**Usage:**

```bash
nx generate @nx/nuxt:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/nuxt:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default      |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                    | `playwright` |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`       |
| `--name`                    | string  | The name of the application.                                                                                                      |              |
| `--rootProject`             | boolean | Create an application at the root of the workspace.                                                                               | `false`      |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false`      |
| `--style`                   | string  | The file extension to be used for style files.                                                                                    | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                   |              |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`       |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |              |

### `storybook-configuration`

Set up Storybook for a Nuxt project.

**Usage:**

```bash
nx generate @nx/nuxt:storybook-configuration [options]
```

**Arguments:**

```bash
nx generate @nx/nuxt:storybook-configuration &lt;project&gt; [options]
```

#### Options

| Option                   | Type    | Description                                                                                                                    | Default                                                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `--configureStaticServe` | boolean | Specifies whether to configure a static file server target for serving storybook. Helpful for speeding up CI build/test times. | `true`                                                                    |
| `--generateStories`      | boolean | Automatically generate `*.stories.ts` files for components declared in this project?                                           | `true`                                                                    |
| `--ignorePaths`          | array   | Paths to ignore when looking for components.                                                                                   | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests`     | boolean | Set up Storybook interaction tests.                                                                                            | `true`                                                                    |
| `--js`                   | boolean | Generate JavaScript story files rather than TypeScript story files.                                                            | `false`                                                                   |
| `--linter`               | string  | The tool to use for running lint checks.                                                                                       | `eslint`                                                                  |
| `--tsConfiguration`      | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js.              | `true`                                                                    |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/nuxt:<generator> --help
```
