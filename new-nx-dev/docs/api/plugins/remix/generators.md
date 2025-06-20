---
title: '@nx/remix Generators'
description: 'Complete reference for all @nx/remix generator commands'
sidebar_label: Generators
---

# @nx/remix Generators

The @nx/remix plugin provides various generators to help you create and configure remix projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `action`

Generate an action for a given route.

**Usage:**

```bash
nx generate @nx/remix:action [options]
```

**Arguments:**

```bash
nx generate @nx/remix:action &lt;path&gt; [options]
```

#### Options

| Option | Type | Description | Default |
| ------ | ---- | ----------- | ------- |

### `application`

Generate a new Remix application.

**Usage:**

```bash
nx generate @nx/remix:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/remix:application &lt;directory&gt; [options]
```

#### Options

| Option             | Type    | Description                                                                                                  | Default |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| `--e2eTestRunner`  | string  | Test runner to use for e2e tests                                                                             | `none`  |
| `--linter`         | string  | The tool to use for running lint checks.                                                                     | `none`  |
| `--name`           | string  | The name of the application.                                                                                 |         |
| `--rootProject`    | boolean |                                                                                                              | `false` |
| `--skipFormat`     | boolean | Skip formatting files                                                                                        | `false` |
| `--tags`           | string  | Add tags to the project (used for linting)                                                                   |         |
| `--unitTestRunner` | string  | Test runner to use for unit tests.                                                                           | `none`  |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |         |

### `convert-to-inferred`

Convert existing Remix project(s) using `@nx/remix:*` executors to use `@nx/remix/plugin`. Defaults to migrating all projects. Pass '--project' to migrate only one target.

**Usage:**

```bash
nx generate @nx/remix:convert-to-inferred [options]
```

#### Options

| Option         | Type    | Description                                                                              | Default |
| -------------- | ------- | ---------------------------------------------------------------------------------------- | ------- |
| `--project`    | string  | The project to convert from using the `@nx/remix:*` executors to use `@nx/remix/plugin`. |         |
| `--skipFormat` | boolean | Whether to format files at the end of the migration.                                     | `false` |

### `cypress-component-configuration`

Add a Cypress component testing configuration to an existing project.

**Usage:**

```bash
nx generate @nx/remix:cypress-component-configuration [options]
```

#### Options

| Option                     | Type    | Description                                                               | Default |
| -------------------------- | ------- | ------------------------------------------------------------------------- | ------- |
| `--project` **[required]** | string  | The name of the project to add cypress component testing configuration to |         |
| `--generateTests`          | boolean | Generate default component tests for existing components in the project   | `false` |
| `--skipFormat`             | boolean | Skip formatting files                                                     | `false` |

### `error-boundary`

Generate an ErrorBoundary for a given route.

**Usage:**

```bash
nx generate @nx/remix:error-boundary [options]
```

#### Options

| Option                  | Type    | Description                                          | Default |
| ----------------------- | ------- | ---------------------------------------------------- | ------- |
| `--path` **[required]** | string  | The path to route file relative to the project root. |         |
| `--skipFormat`          | boolean | Skip formatting files after generation.              | `false` |

### `library`

Generate a Remix library to help structure workspace and application.

**Usage:**

```bash
nx generate @nx/remix:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/remix:library &lt;directory&gt; [options]
```

#### Options

| Option             | Type    | Description                                                                                                  | Default |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| `--buildable`      | boolean | Generate a buildable library that uses rollup to bundle.                                                     | `false` |
| `--bundler`        | string  | The bundler to use. Choosing 'none' means this library is not buildable.                                     | `none`  |
| `--importPath`     | string  | The library name used to import it, like @myorg/my-awesome-lib                                               |         |
| `--js`             | boolean | Generate JavaScript files rather than TypeScript files                                                       | `false` |
| `--linter`         | string  | The tool to use for running lint checks.                                                                     | `none`  |
| `--name`           | string  | Library name                                                                                                 |         |
| `--skipFormat`     | boolean | Skip formatting files after generator runs                                                                   | `false` |
| `--style`          | string  | Generate a stylesheet                                                                                        | `css`   |
| `--tags`           | string  | Add tags to the library (used for linting)                                                                   |         |
| `--unitTestRunner` | string  | Test Runner to use for Unit Tests                                                                            | `none`  |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |         |

### `loader`

Generate an loader for a given route.

**Usage:**

```bash
nx generate @nx/remix:loader [options]
```

**Arguments:**

```bash
nx generate @nx/remix:loader &lt;path&gt; [options]
```

#### Options

| Option | Type | Description | Default |
| ------ | ---- | ----------- | ------- |

### `meta`

Generate a meta function for a given route.

**Usage:**

```bash
nx generate @nx/remix:meta [options]
```

**Arguments:**

```bash
nx generate @nx/remix:meta &lt;path&gt; [options]
```

#### Options

| Option | Type | Description | Default |
| ------ | ---- | ----------- | ------- |

### `resource-route`

Generate a resource route.

**Usage:**

```bash
nx generate @nx/remix:resource-route [options]
```

**Arguments:**

```bash
nx generate @nx/remix:resource-route &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                 | Default |
| -------------- | ------- | --------------------------- | ------- |
| `--action`     | boolean | Generate an action function | `false` |
| `--loader`     | boolean | Generate a loader function  | `true`  |
| `--skipChecks` | boolean | Skip route error detection  | `false` |

### `route`

Generate a route.

**Usage:**

```bash
nx generate @nx/remix:route [options]
```

**Arguments:**

```bash
nx generate @nx/remix:route &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                 | Default |
| -------------- | ------- | --------------------------- | ------- |
| `--action`     | boolean | Generate an action function | `false` |
| `--loader`     | boolean | Generate a loader function  | `false` |
| `--meta`       | boolean | Generate a meta function    | `false` |
| `--skipChecks` | boolean | Skip route error detection  | `false` |
| `--style`      | string  | Generate a stylesheet       | `css`   |

### `setup-tailwind`

Setup tailwindcss for a given project.

**Usage:**

```bash
nx generate @nx/remix:setup-tailwind [options]
```

#### Options

| Option                     | Type    | Description                                | Default |
| -------------------------- | ------- | ------------------------------------------ | ------- |
| `--project` **[required]** | string  | The name of the project to add tailwind to |         |
| `--skipFormat`             | boolean | Skip formatting files after generator runs | `false` |

### `storybook-configuration`

Set up Storybook for a Remix library.

**Usage:**

```bash
nx generate @nx/remix:storybook-configuration [options]
```

**Arguments:**

```bash
nx generate @nx/remix:storybook-configuration &lt;project&gt; [options]
```

#### Options

| Option                   | Type    | Description                                                                                                                    | Default  |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `--configureStaticServe` | boolean | Specifies whether to configure a static file server target for serving storybook. Helpful for speeding up CI build/test times. | `true`   |
| `--configureTestRunner`  | boolean | Add a Storybook Test-Runner target.                                                                                            |          |
| `--generateStories`      | boolean | Automatically generate `*.stories.ts` files for components declared in this project?                                           | `true`   |
| `--ignorePaths`          | array   | Paths to ignore when looking for components.                                                                                   |          |
| `--interactionTests`     | boolean | Set up Storybook interaction tests.                                                                                            | `true`   |
| `--js`                   | boolean | Generate JavaScript story files rather than TypeScript story files.                                                            | `false`  |
| `--linter`               | string  | The tool to use for running lint checks.                                                                                       | `eslint` |
| `--tsConfiguration`      | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js.              | `false`  |

### `style`

Generate a style import and file for a given route.

**Usage:**

```bash
nx generate @nx/remix:style [options]
```

**Arguments:**

```bash
nx generate @nx/remix:style &lt;path&gt; [options]
```

#### Options

| Option | Type | Description | Default |
| ------ | ---- | ----------- | ------- |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/remix:<generator> --help
```
