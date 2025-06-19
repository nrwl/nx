---
title: '@nx/react Generators'
description: 'Complete reference for all @nx/react generator commands'
sidebar_label: Generators
---

# @nx/react Generators

The @nx/react plugin provides various generators to help you create and configure react projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Create a React application for Nx.

**Usage:**

```bash
nx generate @nx/react:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/react:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                   | Default      |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--bundler`                 | string  | The bundler to use.                                                                                                                                                                           | `vite`       |
| `--classComponent`          | boolean | Use class components instead of functional component.                                                                                                                                         | `false`      |
| `--compiler`                | string  | The compiler to use.                                                                                                                                                                          | `babel`      |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                                                                                | `playwright` |
| `--globalCss`               | boolean | Default is `false`. When `true`, the component is generated with `*.css`/`*.scss` instead of `*.module.css`/`*.module.scss`.                                                                  | `false`      |
| `--inSourceTests`           | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false`      |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                                                                                       | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                      | `none`       |
| `--minimal`                 | boolean | Generate a React app with a minimal setup, no separate test files.                                                                                                                            | `false`      |
| `--name`                    | string  | The name of the application.                                                                                                                                                                  |              |
| `--port`                    | number  | The port to use for the development server                                                                                                                                                    | `4200`       |
| `--rootProject`             | boolean | Create a application at the root of the workspace                                                                                                                                             | `false`      |
| `--routing`                 | boolean | Generate application with routes.                                                                                                                                                             | `false`      |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                             | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                        | `false`      |
| `--skipNxJson`              | boolean | Skip updating `nx.json` with default options based on values provided to this app.                                                                                                            | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                    | `false`      |
| `--strict`                  | boolean | Creates an application with strict mode and strict type checking.                                                                                                                             | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                                                                                | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                                                                               |              |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                                                            | `none`       |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                                                                                  |              |
| `--useReactRouter`          | boolean | Use React Router for routing.                                                                                                                                                                 | `false`      |

### `component`

Create a React Component for Nx.

**Usage:**

```bash
nx generate @nx/react:component [options]
```

**Aliases:** `c`

**Arguments:**

```bash
nx generate @nx/react:component &lt;path&gt; [options]
```

#### Options

| Option             | Type    | Description                                                                                                                                                                                   | Default |
| ------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--classComponent` | boolean | Use class components instead of functional component.                                                                                                                                         | `false` |
| `--export`         | boolean | When true, the component is exported from the project `index.ts` (if it exists).                                                                                                              | `false` |
| `--globalCss`      | boolean | Default is `false`. When `true`, the component is generated with `*.css`/`*.scss` instead of `*.module.css`/`*.module.scss`.                                                                  | `false` |
| `--inSourceTests`  | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false` |
| `--js`             | boolean | Generate JavaScript files rather than TypeScript files.                                                                                                                                       |         |
| `--name`           | string  | The component symbol name. Defaults to the last segment of the file path.                                                                                                                     |         |
| `--routing`        | boolean | Generate a library with routes.                                                                                                                                                               |         |
| `--skipFormat`     | boolean | Skip formatting files.                                                                                                                                                                        | `false` |
| `--skipTests`      | boolean | When true, does not create `spec.ts` test files for the new component.                                                                                                                        | `false` |
| `--style`          | string  | The file extension to be used for style files.                                                                                                                                                | `css`   |

### `component-story`

Generate storybook story for a react component.

**Usage:**

```bash
nx generate @nx/react:component-story [options]
```

#### Options

| Option                           | Type    | Description                                                | Default |
| -------------------------------- | ------- | ---------------------------------------------------------- | ------- |
| `--componentPath` **[required]** | string  | Relative path to the component file from the library root. |         |
| `--project` **[required]**       | string  | The project where to add the components.                   |         |
| `--interactionTests`             | boolean | Set up Storybook interaction tests.                        | `true`  |
| `--skipFormat`                   | boolean | Skip formatting files.                                     | `false` |

### `component-test`

Add a Cypress component test for a component.

**Usage:**

```bash
nx generate @nx/react:component-test [options]
```

#### Options

| Option                           | Type   | Description                                       | Default |
| -------------------------------- | ------ | ------------------------------------------------- | ------- |
| `--componentPath` **[required]** | string | Path to component, from the project source root   |         |
| `--project` **[required]**       | string | The name of the project the component is apart of |         |

### `cypress-component-configuration`

Add a Cypress component testing configuration to an existing project.

**Usage:**

```bash
nx generate @nx/react:cypress-component-configuration [options]
```

#### Options

| Option                     | Type    | Description                                                                                                                                                                                                                  | Default |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project` **[required]** | string  | The name of the project to add cypress component testing configuration to                                                                                                                                                    |         |
| `--buildTarget`            | string  | A build target used to configure Cypress component testing in the format of `project:target[:configuration]`. The build target should be from a React app. If not provided we will try to infer it from your projects usage. |         |
| `--bundler`                | string  | The bundler to use for Cypress Component Testing.                                                                                                                                                                            |         |
| `--generateTests`          | boolean | Generate default component tests for existing components in the project                                                                                                                                                      | `false` |
| `--skipFormat`             | boolean | Skip formatting files                                                                                                                                                                                                        | `false` |

### `federate-module`

Create a federated module, which can be loaded by a Consumer (host) via a Producer (remote).

**Usage:**

```bash
nx generate @nx/react:federate-module [options]
```

**Arguments:**

```bash
nx generate @nx/react:federate-module &lt;path&gt; [options]
```

#### Options

| Option                    | Type    | Description                                                                        | Default   |
| ------------------------- | ------- | ---------------------------------------------------------------------------------- | --------- |
| `--name` **[required]**   | string  | The name of the module.                                                            |           |
| `--remote` **[required]** | string  | The name of the Producer (remote).                                                 |           |
| `--bundler`               | string  | The bundler to use.                                                                | `rspack`  |
| `--e2eTestRunner`         | string  | Test runner to use for end to end (E2E) tests.                                     | `cypress` |
| `--host`                  | string  | The Consumer (host) application for this Producer (remote).                        |           |
| `--linter`                | string  | The tool to use for running lint checks.                                           | `eslint`  |
| `--remoteDirectory`       | string  | The directory of the new Producer (remote) application if one needs to be created. |           |
| `--skipFormat`            | boolean | Skip formatting files.                                                             | `false`   |
| `--style`                 | string  | The file extension to be used for style files.                                     | `none`    |
| `--unitTestRunner`        | string  | Test runner to use for unit tests.                                                 | `jest`    |

### `hook`

Create a React component using Hooks in a dedicated React project.

**Usage:**

```bash
nx generate @nx/react:hook [options]
```

**Aliases:** `c`

**Arguments:**

```bash
nx generate @nx/react:hook &lt;path&gt; [options]
```

#### Options

| Option        | Type    | Description                                                                 | Default |
| ------------- | ------- | --------------------------------------------------------------------------- | ------- |
| `--export`    | boolean | When true, the hook is exported from the project `index.ts` (if it exists). | `false` |
| `--js`        | boolean | Generate JavaScript files rather than TypeScript files.                     |         |
| `--name`      | string  | The hook symbol name. Defaults to the last segment of the file path.        |         |
| `--skipTests` | boolean | When true, does not create `spec.ts` test files for the new hook.           | `false` |

### `host`

Create Module Federation configuration files for given React Consumer (Host) Application.

**Usage:**

```bash
nx generate @nx/react:host [options]
```

**Aliases:** `consumer`

**Arguments:**

```bash
nx generate @nx/react:host &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                         | Default      |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--bundler`                 | string  | The bundler to use.                                                                                                                 | `rspack`     |
| `--classComponent`          | boolean | Use class components instead of functional component.                                                                               | `false`      |
| `--compiler`                | string  | The compiler to use                                                                                                                 | `babel`      |
| `--devServerPort`           | number  | The port for the dev server of the Producer (remote) app.                                                                           | `4200`       |
| `--dynamic`                 | boolean | Should the Consumer (host) application use dynamic federation?                                                                      | `false`      |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                      | `playwright` |
| `--globalCss`               | boolean | Default is false. When true, the component is generated with _.css/_.scss instead of _.module.css/_.module.scss                     | `false`      |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                             | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                            | `eslint`     |
| `--minimal`                 | boolean | Generate a React app with a minimal setup. No nx starter template.                                                                  | `false`      |
| `--name`                    | string  | The name of the Consumer (host) application to generate the Module Federation configuration                                         |              |
| `--remotes`                 | array   | A list of Producer (remote) application names that the Consumer (host) application should consume.                                  | `[]`         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.   | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                              | `false`      |
| `--skipNxJson`              | boolean | Skip updating nx.json with default options based on values provided to this app (e.g. babel, style).                                | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                          | `false`      |
| `--ssr`                     | boolean | Whether to configure SSR for the Consumer (host) application                                                                        | `false`      |
| `--strict`                  | boolean | Creates an application with strict mode and strict type checking                                                                    | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                      | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                     |              |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. When --js is used, this flag is ignored. | `true`       |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                  | `jest`       |

### `library`

Create a React Library for an Nx workspace.

**Usage:**

```bash
nx generate @nx/react:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/react:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                         | Default |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--appProject`              | string  | The application project to add the library route to.                                                                                |         |
| `--buildable`               | boolean | Generate a buildable library that uses rollup to bundle.                                                                            | `false` |
| `--bundler`                 | string  | The bundler to use. Choosing 'none' means this library is not buildable.                                                            | `none`  |
| `--compiler`                | string  | Which compiler to use.                                                                                                              | `babel` |
| `--component`               | boolean | Generate a default component.                                                                                                       | `true`  |
| `--globalCss`               | boolean | When `true`, the stylesheet is generated using global CSS instead of CSS modules (e.g. file is `*.css` rather than `*.module.css`). | `false` |
| `--importPath`              | string  | The library name used to import it, like `@myorg/my-awesome-lib`.                                                                   |         |
| `--inSourceTests`           | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files.                  | `false` |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                             | `false` |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                            | `none`  |
| `--minimal`                 | boolean | Create a React library with a minimal setup, no separate test files.                                                                | `false` |
| `--name`                    | string  | Library name                                                                                                                        |         |
| `--publishable`             | boolean | Create a publishable library.                                                                                                       |         |
| `--routing`                 | boolean | Generate library with routes.                                                                                                       |         |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.   | `false` |
| `--simpleName`              | boolean | Don't include the directory in the name of the module of the library.                                                               | `false` |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                              | `false` |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                          | `false` |
| `--skipTsConfig`            | boolean | Do not update `tsconfig.json` for development experience.                                                                           | `false` |
| `--strict`                  | boolean | Whether to enable tsconfig strict mode or not.                                                                                      | `true`  |
| `--style`                   | string  | The file extension to be used for style files.                                                                                      | `css`   |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                         |         |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                  | `none`  |
| `--useProjectJson`          | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file.                        |         |

### `redux`

Create a Redux state slice for a React project.

**Usage:**

```bash
nx generate @nx/react:redux [options]
```

**Aliases:** `slice`

**Arguments:**

```bash
nx generate @nx/react:redux &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                                                                       | Default |
| -------------- | ------- | --------------------------------------------------------------------------------- | ------- |
| `--appProject` | string  | The application project to add the slice to.                                      |         |
| `--js`         | boolean | Generate JavaScript files rather than TypeScript files.                           |         |
| `--name`       | string  | The Redux state slice symbol name. Defaults to the last segment of the file path. |         |

### `remote`

Create Module Federation configuration files for given React Producer (Remote) Application.

**Usage:**

```bash
nx generate @nx/react:remote [options]
```

**Aliases:** `producer`

**Arguments:**

```bash
nx generate @nx/react:remote &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                         | Default      |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--bundler`                 | string  | The bundler to use.                                                                                                                 | `rspack`     |
| `--classComponent`          | boolean | Use class components instead of functional component.                                                                               | `false`      |
| `--compiler`                | string  | The compiler to use.                                                                                                                | `babel`      |
| `--devServerPort`           | number  | The port for the dev server of the Producer (remote) app.                                                                           |              |
| `--dynamic`                 | boolean | Should the Consumer (host) application use dynamic federation?                                                                      | `false`      |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                      | `playwright` |
| `--globalCss`               | boolean | Default is false. When true, the component is generated with _.css/_.scss instead of _.module.css/_.module.scss.                    | `false`      |
| `--host`                    | string  | The Consumer (host) application for this Producer (remote).                                                                         |              |
| `--js`                      | boolean | Generate JavaScript files rather than TypeScript files.                                                                             | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                            | `eslint`     |
| `--name`                    | string  | The name of the Producer (remote) application to generate the Module Federation configuration                                       |              |
| `--routing`                 | boolean | Generate application with routes.                                                                                                   | `false`      |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons.   | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                              | `false`      |
| `--skipNxJson`              | boolean | Skip updating nx.json with default options based on values provided to this app (e.g. babel, style).                                | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                          | `false`      |
| `--ssr`                     | boolean | Whether to configure SSR for the Consumer (host) application                                                                        | `false`      |
| `--strict`                  | boolean | Creates an application with strict mode and strict type checking.                                                                   | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                      | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                     |              |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. When --js is used, this flag is ignored. | `true`       |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                  | `jest`       |

### `setup-ssr`

Create the additional configuration required to enable SSR via Express for a React application.

**Usage:**

```bash
nx generate @nx/react:setup-ssr [options]
```

**Arguments:**

```bash
nx generate @nx/react:setup-ssr &lt;project&gt; [options]
```

#### Options

| Option                     | Type    | Description                                                                     | Default   |
| -------------------------- | ------- | ------------------------------------------------------------------------------- | --------- |
| `--appComponentImportPath` | string  | The import path of the &lt;App/ &gt; component, relative to project sourceRoot. | `app/app` |
| `--bundler`                | string  | The bundler to use.                                                             | `webpack` |
| `--extraInclude`           | array   | Extra include entries in tsconfig.                                              | `[]`      |
| `--serverPort`             | number  | The port for the Express server.                                                | `4200`    |
| `--skipFormat`             | boolean | Skip formatting the workspace after the generator completes.                    |           |

### `setup-tailwind`

Adds the Tailwind CSS configuration files for a given React project and installs, if needed, the packages required for Tailwind CSS to work.

**Usage:**

```bash
nx generate @nx/react:setup-tailwind [options]
```

**Arguments:**

```bash
nx generate @nx/react:setup-tailwind &lt;project&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                                | Default |
| ------------------- | ------- | ------------------------------------------------------------------------------------------ | ------- |
| `--buildTarget`     | string  | The name of the target used to build the project. This option is not needed in most cases. | `build` |
| `--skipFormat`      | boolean | Skips formatting the workspace after the generator completes.                              |         |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`.                                                 | `false` |

### `stories`

Generate stories/specs for all components declared in a project.

**Usage:**

```bash
nx generate @nx/react:stories [options]
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

Set up Storybook for a React app or library.

**Usage:**

```bash
nx generate @nx/react:storybook-configuration [options]
```

**Arguments:**

```bash
nx generate @nx/react:storybook-configuration &lt;project&gt; [options]
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
nx generate @nx/react:<generator> --help
```
