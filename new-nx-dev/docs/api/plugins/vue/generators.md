---
title: '@nx/vue Generators'
description: 'Complete reference for all @nx/vue generator commands'
sidebar_label: Generators
---

# @nx/vue Generators

The @nx/vue plugin provides various generators to help you create and configure vue projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Create a Vue application for Nx.

**Usage:**

```bash
nx generate @nx/vue:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/vue:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                   | Default      |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--bundler`                 | string  | The bundler to use.                                                                                                                                                                           | `vite`       |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                                                                                | `playwright` |
| `--inSourceTests`           | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false`      |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                                                                                       | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                      | `none`       |
| `--name`                    | string  | The name of the application.                                                                                                                                                                  |              |
| `--rootProject`             | boolean | Create a application at the root of the workspace                                                                                                                                             | `false`      |
| `--routing`                 | boolean | Generate application with routes.                                                                                                                                                             | `false`      |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                             | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                        | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                    | `false`      |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                                                                                | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                                                                                | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                                                                               |              |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                                                            | `none`       |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                                                                                  |              |

### `component`

Create a Vue Component for Nx.

**Usage:**

```bash
nx generate @nx/vue:component [options]
```

**Aliases:** `c`

**Arguments:**

```bash
nx generate @nx/vue:component &lt;path&gt; [options]
```

#### Options

| Option            | Type    | Description                                                                                                                                                                                   | Default |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--export`        | boolean | When true, the component is exported from the project `index.ts` (if it exists).                                                                                                              | `false` |
| `--fileName`      | string  | Create a component with this file name.                                                                                                                                                       |         |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false` |
| `--js`            | boolean | Generate JavaScript files rather than TypeScript files.                                                                                                                                       | `false` |
| `--routing`       | boolean | Generate a library with routes.                                                                                                                                                               |         |
| `--skipFormat`    | boolean | Skip formatting files.                                                                                                                                                                        | `false` |
| `--skipTests`     | boolean | When true, does not create `spec.ts` test files for the new component.                                                                                                                        | `false` |

### `library`

Create a Vue Library for an Nx workspace.

**Usage:**

```bash
nx generate @nx/vue:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/vue:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                       | Default |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--appProject`              | string  | The application project to add the library route to.                                                                              |         |
| `--bundler`                 | string  | The bundler to use. Choosing 'none' means this library is not buildable.                                                          | `none`  |
| `--component`               | boolean | Generate a default component.                                                                                                     | `false` |
| `--importPath`              | string  | The library name used to import it, like `@myorg/my-awesome-lib`.                                                                 |         |
| `--inSourceTests`           | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files.                | `false` |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                           | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                          | `none`  |
| `--minimal`                 | boolean | Create a Vue library with a minimal setup, no separate test files.                                                                | `false` |
| `--name`                    | string  | Library name                                                                                                                      |         |
| `--publishable`             | boolean | Create a publishable library.                                                                                                     |         |
| `--routing`                 | boolean | Generate library with routes.                                                                                                     |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                            | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                        | `false` |
| `--skipTsConfig`            | boolean | Do not update `tsconfig.json` for development experience.                                                                         | `false` |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                    | `true`  |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                       |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                      |         |

### `setup-tailwind`

Adds the Tailwind CSS configuration files for a given Vue project and installs, if needed, the packages required for Tailwind CSS to work.

**Usage:**

```bash
nx generate @nx/vue:setup-tailwind [options]
```

**Arguments:**

```bash
nx generate @nx/vue:setup-tailwind &lt;project&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                                                                                         | Default |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--skipFormat`      | boolean | Skips formatting the workspace after the generator completes.                                                                                       |         |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`.                                                                                                          | `false` |
| `--stylesheet`      | string  | Path to the styles entry point relative to the workspace root. This option is only needed if the stylesheet location cannot be found automatically. |         |

### `stories`

Generate stories/specs for all components declared in a project.

**Usage:**

```bash
nx generate @nx/vue:stories [options]
```

#### Options

| Option                     | Type    | Description                                             | Default                                                                   |
| -------------------------- | ------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `--project` **[required]** | string  | Project for which to generate stories.                  |                                                                           |
| `--ignorePaths`            | array   | Paths to ignore when looking for components.            | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests`       | boolean | Set up Storybook interaction tests.                     | `true`                                                                    |
| `--js`                     | boolean | Generate JavaScript files rather than TypeScript files. | `false`                                                                   |
| `--skipFormat`             | boolean | Skip formatting files.                                  | `false`                                                                   |

### `storybook-configuration`

Set up Storybook for a Vue project.

**Usage:**

```bash
nx generate @nx/vue:storybook-configuration [options]
```

**Arguments:**

```bash
nx generate @nx/vue:storybook-configuration &lt;project&gt; [options]
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
nx generate @nx/vue:<generator> --help
```
