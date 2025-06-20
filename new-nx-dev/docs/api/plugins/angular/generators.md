---
title: '@nx/angular Generators'
description: 'Complete reference for all @nx/angular generator commands'
sidebar_label: Generators
---

# @nx/angular Generators

The @nx/angular plugin provides various generators to help you create and configure angular projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## Available Generators

### `application`

Creates an Angular application.

**Usage:**

```bash
nx generate @nx/angular:application [options]
```

**Aliases:** `app`

**Arguments:**

```bash
nx generate @nx/angular:application &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                                                                                                                                    | Default      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--addTailwind`             | boolean | Whether to configure Tailwind CSS for the application.                                                                                                                                                                                                                                                         | `false`      |
| `--backendProject`          | string  | Backend project that provides data to this application. This sets up `proxy.config.json`.                                                                                                                                                                                                                      |              |
| `--bundler`                 | string  | Bundler to use to build the application.                                                                                                                                                                                                                                                                       | `esbuild`    |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                                                                                                                                                                                                 | `playwright` |
| `--inlineStyle`             | boolean | Specifies if the style will be in the ts file.                                                                                                                                                                                                                                                                 | `false`      |
| `--inlineTemplate`          | boolean | Specifies if the template will be in the ts file.                                                                                                                                                                                                                                                              | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                                                                                                                                       | `eslint`     |
| `--minimal`                 | boolean | Generate a Angular app with a minimal setup.                                                                                                                                                                                                                                                                   | `false`      |
| `--name`                    | string  | The name of the application.                                                                                                                                                                                                                                                                                   |              |
| `--port`                    | number  | The port at which the remote application should be served.                                                                                                                                                                                                                                                     |              |
| `--prefix`                  | string  | The prefix to apply to generated selectors.                                                                                                                                                                                                                                                                    | `app`        |
| `--rootProject`             | boolean | Create an application at the root of the workspace.                                                                                                                                                                                                                                                            | `false`      |
| `--routing`                 | boolean | Enable routing for the application.                                                                                                                                                                                                                                                                            | `true`       |
| `--serverRouting`           | boolean | Creates a server application using the Server Routing and App Engine APIs for application using the `application` builder (Developer Preview). _Note: this is only supported in Angular versions 19.x.x_. From Angular 20 onwards, SSR will always enable server routing when using the `application` builder. |              |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                                                                                                                                              | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                                                                                                                                         | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                                                                                                                                     | `false`      |
| `--skipTests`               | boolean | Skip creating spec files.                                                                                                                                                                                                                                                                                      | `false`      |
| `--ssr`                     | boolean | Creates an application with Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering) enabled.                                                                                                                                                                                                 | `false`      |
| `--standalone`              | boolean | Generate an application that is setup to use standalone components.                                                                                                                                                                                                                                            | `true`       |
| `--strict`                  | boolean | Create an application with stricter type checking and build optimization options.                                                                                                                                                                                                                              | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                                                                                                                                                                                                 | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                                                                                                                                                                                                |              |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                                                                                                                                                                             | `jest`       |
| `--viewEncapsulation`       | string  | Specifies the view encapsulation strategy.                                                                                                                                                                                                                                                                     |              |

### `component`

Creates a new Angular component.

**Usage:**

```bash
nx generate @nx/angular:component [options]
```

**Aliases:** `c`

**Arguments:**

```bash
nx generate @nx/angular:component &lt;path&gt; [options]
```

#### Options

| Option                | Type    | Description                                                                                                                                                                                                                                                                               | Default   |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--changeDetection`   | string  | The change detection strategy to use in the new component.                                                                                                                                                                                                                                | `Default` |
| `--displayBlock`      | boolean | Specifies if the style will contain `:host &#123; display: block; &#125;`.                                                                                                                                                                                                                | `false`   |
| `--export`            | boolean | Specifies if the component should be exported in the declaring `NgModule`. Additionally, if the project is a library, the component will be exported from the project's entry point (normally `index.ts`) if the module it belongs to is also exported or if the component is standalone. | `false`   |
| `--exportDefault`     | boolean | Use default export for the component instead of a named export.                                                                                                                                                                                                                           | `false`   |
| `--inlineStyle`       | boolean | Include styles inline in the component.ts file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the component.ts file.                                                                                                           | `false`   |
| `--inlineTemplate`    | boolean | Include template inline in the component.ts file. By default, an external template file is created and referenced in the component.ts file.                                                                                                                                               | `false`   |
| `--module`            | string  | The filename or path to the NgModule that will declare this component.                                                                                                                                                                                                                    |           |
| `--name`              | string  | The component symbol name. Defaults to the last segment of the file path.                                                                                                                                                                                                                 |           |
| `--ngHtml`            | boolean | Generate component template files with an '.ng.html' file extension instead of '.html'.                                                                                                                                                                                                   | `false`   |
| `--prefix`            | string  | The prefix to apply to the generated component selector.                                                                                                                                                                                                                                  |           |
| `--selector`          | string  | The HTML selector to use for this component.                                                                                                                                                                                                                                              |           |
| `--skipFormat`        | boolean | Skip formatting files.                                                                                                                                                                                                                                                                    | `false`   |
| `--skipImport`        | boolean | Do not import this component into the owning NgModule.                                                                                                                                                                                                                                    | `false`   |
| `--skipSelector`      | boolean | Specifies if the component should have a selector or not.                                                                                                                                                                                                                                 | `false`   |
| `--skipTests`         | boolean | Do not create `spec.ts` test files for the new component.                                                                                                                                                                                                                                 | `false`   |
| `--standalone`        | boolean | Whether the generated component is standalone.                                                                                                                                                                                                                                            | `true`    |
| `--style`             | string  | The file extension or preprocessor to use for style files, or `none` to skip generating the style file.                                                                                                                                                                                   | `css`     |
| `--type`              | string  | Append a custom type to the component's filename. It defaults to 'component' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified.                                                                                                             |           |
| `--viewEncapsulation` | string  | The view encapsulation strategy to use in the new component.                                                                                                                                                                                                                              |           |

### `component-test`

Create a `*.cy.ts` file for Cypress component testing for an Angular component.

**Usage:**

```bash
nx generate @nx/angular:component-test [options]
```

#### Options

| Option                               | Type    | Description                                                                    | Default |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------ | ------- |
| `--componentDir` **[required]**      | string  | Relative path to the folder that contains the component from the project root. |         |
| `--componentFileName` **[required]** | string  | File name that contains the component without the `.ts` extension.             |         |
| `--componentName` **[required]**     | string  | Class name of the component to create a test for.                              |         |
| `--project` **[required]**           | string  | The name of the project where the component is located.                        |         |
| `--skipFormat`                       | boolean | Skip formatting files.                                                         | `false` |

### `convert-to-application-executor`

Converts a project or all projects using one of the `@angular-devkit/build-angular:browser`, `@angular-devkit/build-angular:browser-esbuild`, `@nx/angular:browser` and `@nx/angular:browser-esbuild` executors to use the `@nx/angular:application` executor or the `@angular-devkit/build-angular:application` builder. If the converted target is using one of the `@nx/angular` executors, the `@nx/angular:application` executor will be used. Otherwise, the `@angular-devkit/build-angular:application` builder will be used.

**Usage:**

```bash
nx generate @nx/angular:convert-to-application-executor [options]
```

**Arguments:**

```bash
nx generate @nx/angular:convert-to-application-executor &lt;project&gt; [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

### `convert-to-rspack`

Creates an Angular application.

**Usage:**

```bash
nx generate @nx/angular:convert-to-rspack [options]
```

**Arguments:**

```bash
nx generate @nx/angular:convert-to-rspack &lt;project&gt; [options]
```

#### Options

| Option          | Type    | Description                   | Default |
| --------------- | ------- | ----------------------------- | ------- |
| `--skipFormat`  | boolean | Skip formatting files.        | `false` |
| `--skipInstall` | boolean | Skip installing dependencies. | `false` |

### `convert-to-with-mf`

Converts an old micro frontend configuration to use the new withModuleFederation helper. It will run successfully if the following conditions are met:

- Is either a host or remote application
- Shared npm package configurations have not been modified
- Name used to identify the Micro Frontend application matches the project name

&#123;% callout type="warning" title="Overrides" %&#125;This generator will overwrite your webpack config. If you have additional custom configuration in your config file, it will be lost!&#123;% /callout %&#125;.

**Usage:**

```bash
nx generate @nx/angular:convert-to-with-mf [options]
```

**Arguments:**

```bash
nx generate @nx/angular:convert-to-with-mf &lt;project&gt; [options]
```

#### Options

| Option         | Type    | Description            | Default |
| -------------- | ------- | ---------------------- | ------- |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

### `cypress-component-configuration`

Add a Cypress component testing configuration to an existing project. Cypress v10.7.0 or higher is required.

**Usage:**

```bash
nx generate @nx/angular:cypress-component-configuration [options]
```

#### Options

| Option                     | Type    | Description                                                                                                                                                                                                                | Default |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--project` **[required]** | string  | The name of the project to add cypress component testing configuration to                                                                                                                                                  |         |
| `--buildTarget`            | string  | A build target used to configure Cypress component testing in the format of `project:target[:configuration]`. The build target should be an angular app. If not provided we will try to infer it from your projects usage. |         |
| `--generateTests`          | boolean | Generate default component tests for existing components in the project                                                                                                                                                    | `false` |
| `--skipFormat`             | boolean | Skip formatting files                                                                                                                                                                                                      | `false` |

### `directive`

Creates a new Angular directive.

**Usage:**

```bash
nx generate @nx/angular:directive [options]
```

**Aliases:** `d`

**Arguments:**

```bash
nx generate @nx/angular:directive &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                                                                                                                                                                   | Default |
| -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--export`     | boolean | The declaring NgModule exports this directive.                                                                                                                                | `false` |
| `--module`     | string  | The filename of the declaring NgModule.                                                                                                                                       |         |
| `--name`       | string  | The directive symbol name. Defaults to the last segment of the file path.                                                                                                     |         |
| `--prefix`     | string  | A prefix to apply to generated selectors.                                                                                                                                     |         |
| `--selector`   | string  | The HTML selector to use for this directive.                                                                                                                                  |         |
| `--skipFormat` | boolean | Skip formatting of files.                                                                                                                                                     | `false` |
| `--skipImport` | boolean | Do not import this directive into the owning NgModule.                                                                                                                        | `false` |
| `--skipTests`  | boolean | Do not create "spec.ts" test files for the new class.                                                                                                                         | `false` |
| `--standalone` | boolean | Whether the generated directive is standalone.                                                                                                                                | `true`  |
| `--type`       | string  | Append a custom type to the directive's filename. It defaults to 'directive' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified. |         |

### `federate-module`

Create a federated module, which is exposed by a Producer (remote) and can be subsequently loaded by a Consumer (host).

**Usage:**

```bash
nx generate @nx/angular:federate-module [options]
```

**Arguments:**

```bash
nx generate @nx/angular:federate-module &lt;path&gt; [options]
```

#### Options

| Option                    | Type    | Description                                                                                                 | Default   |
| ------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- | --------- |
| `--name` **[required]**   | string  | The name of the module.                                                                                     |           |
| `--remote` **[required]** | string  | The name of the Producer (remote).                                                                          |           |
| `--e2eTestRunner`         | string  | Test runner to use for end to end (e2e) tests of the Producer (remote) if it needs to be created.           | `cypress` |
| `--host`                  | string  | The Consumer (host) application for this Producer (remote).                                                 |           |
| `--remoteDirectory`       | string  | The directory of the new Producer (remote) application if one needs to be created.                          |           |
| `--skipFormat`            | boolean | Skip formatting files.                                                                                      | `false`   |
| `--standalone`            | boolean | Whether to generate the Producer (remote) application with standalone components if it needs to be created. | `true`    |
| `--style`                 | string  | The file extension to be used for style files for the Producer (remote) if one needs to be created.         | `css`     |
| `--unitTestRunner`        | string  | Test runner to use for unit tests of the Producer (remote) if it needs to be created.                       | `jest`    |

### `host`

Create an Angular Consumer (Host) Module Federation Application.

**Usage:**

```bash
nx generate @nx/angular:host [options]
```

**Aliases:** `consumer`

**Arguments:**

```bash
nx generate @nx/angular:host &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                                                                                                                                    | Default      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--addTailwind`             | boolean | Whether to configure Tailwind CSS for the application.                                                                                                                                                                                                                                                         | `false`      |
| `--backendProject`          | string  | Backend project that provides data to this application. This sets up `proxy.config.json`.                                                                                                                                                                                                                      |              |
| `--bundler`                 | string  | The bundler to use for the host application.                                                                                                                                                                                                                                                                   | `webpack`    |
| `--dynamic`                 | boolean | Should the host application use dynamic federation?                                                                                                                                                                                                                                                            | `false`      |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                                                                                                                                                                                                 | `playwright` |
| `--inlineStyle`             | boolean | Specifies if the style will be in the ts file.                                                                                                                                                                                                                                                                 | `false`      |
| `--inlineTemplate`          | boolean | Specifies if the template will be in the ts file.                                                                                                                                                                                                                                                              | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                                                                                                                                       | `eslint`     |
| `--name`                    | string  | The name to give to the Consumer (host) Angular application.                                                                                                                                                                                                                                                   |              |
| `--prefix`                  | string  | The prefix to apply to generated selectors.                                                                                                                                                                                                                                                                    |              |
| `--remotes`                 | array   | The names of the Producers (remote) applications to add to the Consumer (host).                                                                                                                                                                                                                                |              |
| `--serverRouting`           | boolean | Creates a server application using the Server Routing and App Engine APIs for application using the `application` builder (Developer Preview). _Note: this is only supported in Angular versions 19.x.x_. From Angular 20 onwards, SSR will always enable server routing when using the `application` builder. |              |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                                                                                                                                              | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                                                                                                                                         | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                                                                                                                                     | `false`      |
| `--skipPostInstall`         | boolean | Do not add or append `ngcc` to the `postinstall` script in `package.json`.                                                                                                                                                                                                                                     | `false`      |
| `--skipTests`               | boolean | Skip creating spec files.                                                                                                                                                                                                                                                                                      | `false`      |
| `--ssr`                     | boolean | Whether to configure SSR for the Consumer (host) application                                                                                                                                                                                                                                                   | `false`      |
| `--standalone`              | boolean | Whether to generate a Consumer (host) application that uses standalone components.                                                                                                                                                                                                                             | `true`       |
| `--strict`                  | boolean | Create an application with stricter type checking and build optimization options.                                                                                                                                                                                                                              | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                                                                                                                                                                                                 | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                                                                                                                                                                                                |              |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS.                                                                                                                                                                                                                     | `true`       |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                                                                                                                                                                             | `jest`       |
| `--viewEncapsulation`       | string  | Specifies the view encapsulation strategy.                                                                                                                                                                                                                                                                     |              |

### `library`

Creates an Angular library.

**Usage:**

```bash
nx generate @nx/angular:library [options]
```

**Aliases:** `lib`

**Arguments:**

```bash
nx generate @nx/angular:library &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                                                                                 | Default   |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--addModuleSpec`           | boolean | Add a module spec file.                                                                                                                                                                                                                                     | `false`   |
| `--addTailwind`             | boolean | Whether to configure Tailwind CSS for the application. It can only be used with buildable and publishable libraries. Non-buildable libraries will use the application's Tailwind configuration.                                                             | `false`   |
| `--buildable`               | boolean | Generate a buildable library.                                                                                                                                                                                                                               | `false`   |
| `--changeDetection`         | string  | The change detection strategy to use in the new component. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                                                      | `Default` |
| `--compilationMode`         | string  | Specifies the compilation mode to use. If not specified, it will default to `partial` for publishable libraries and to `full` for buildable libraries. The `full` value can not be used for publishable libraries.                                          |           |
| `--displayBlock`            | boolean | Specifies if the component generated style will contain `:host &#123; display: block; &#125;`. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                  | `false`   |
| `--flat`                    | boolean | Ensure the generated standalone component is not placed in a subdirectory. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                                      | `false`   |
| `--importPath`              | string  | The library name used to import it, like `@myorg/my-awesome-lib`. Must be a valid npm name.                                                                                                                                                                 |           |
| `--inlineStyle`             | boolean | Include styles inline in the component.ts file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the component.ts file. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false`   |
| `--inlineTemplate`          | boolean | Include template inline in the component.ts file. By default, an external template file is created and referenced in the component.ts file. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                     | `false`   |
| `--lazy`                    | boolean | Add `RouterModule.forChild` when set to true, and a simple array of routes when set to false.                                                                                                                                                               | `false`   |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                                                                                    | `eslint`  |
| `--name`                    | string  | The name of the library.                                                                                                                                                                                                                                    |           |
| `--parent`                  | string  | Path to the parent route configuration using `loadChildren` or `children`, depending on what `lazy` is set to.                                                                                                                                              |           |
| `--prefix`                  | string  | The prefix to apply to generated selectors.                                                                                                                                                                                                                 |           |
| `--publishable`             | boolean | Generate a publishable library.                                                                                                                                                                                                                             | `false`   |
| `--routing`                 | boolean | Add router configuration. See `lazy` for more information.                                                                                                                                                                                                  | `false`   |
| `--selector`                | string  | The HTML selector to use for this component. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                                                                    |           |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                                                                                           | `false`   |
| `--simpleName`              | boolean | Don't include the directory in the name of the module or standalone component entry of the library.                                                                                                                                                         | `false`   |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                                                                                      | `false`   |
| `--skipModule`              | boolean | Whether to skip the creation of a default module when generating the library.                                                                                                                                                                               | `false`   |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                                                                                  | `false`   |
| `--skipSelector`            | boolean | Specifies if the component should have a selector or not. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                                                       | `false`   |
| `--skipTests`               | boolean | Do not create `spec.ts` test files for the new component. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                                                       | `false`   |
| `--skipTsConfig`            | boolean | Do not update `tsconfig.json` for development experience.                                                                                                                                                                                                   | `false`   |
| `--standalone`              | boolean | Generate a library that uses a standalone component instead of a module as the entry point.                                                                                                                                                                 | `true`    |
| `--strict`                  | boolean | Create a library with stricter type checking and build optimization options.                                                                                                                                                                                | `true`    |
| `--style`                   | string  | The file extension or preprocessor to use for style files, or `none` to skip generating the style file. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                         | `css`     |
| `--tags`                    | string  | Add tags to the library (used for linting).                                                                                                                                                                                                                 |           |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                                                                                                                          | `jest`    |
| `--viewEncapsulation`       | string  | The view encapsulation strategy to use in the new component. Disclaimer: This option is only valid when `--standalone` is set to `true`.                                                                                                                    |           |

### `library-secondary-entry-point`

Creates a secondary entry point for an Angular publishable library.

**Usage:**

```bash
nx generate @nx/angular:library-secondary-entry-point [options]
```

**Aliases:** `secondary-entry-point`, `entry-point`

**Arguments:**

```bash
nx generate @nx/angular:library-secondary-entry-point &lt;name&gt; [options]
```

#### Options

| Option                     | Type    | Description                                                      | Default |
| -------------------------- | ------- | ---------------------------------------------------------------- | ------- |
| `--library` **[required]** | string  | The name of the library to create the secondary entry point for. |         |
| `--skipFormat`             | boolean | Skip formatting files.                                           | `false` |
| `--skipModule`             | boolean | Skip generating a module for the secondary entry point.          | `false` |

### `move`

Move an Angular project to another folder in the workspace.

**Usage:**

```bash
nx generate @nx/angular:move [options]
```

**Aliases:** `mv`

**Arguments:**

```bash
nx generate @nx/angular:move &lt;destination&gt; [options]
```

#### Options

| Option                         | Type    | Description                                             | Default |
| ------------------------------ | ------- | ------------------------------------------------------- | ------- |
| `--projectName` **[required]** | string  | The name of the Angular project to move.                |         |
| `--importPath`                 | string  | The new import path to use in the `tsconfig.base.json`. |         |
| `--newProjectName`             | string  | The new name of the project after the move.             |         |
| `--skipFormat`                 | boolean | Skip formatting files.                                  | `false` |
| `--updateImportPath`           | boolean | Update the import path to reflect the new location.     | `true`  |

### `ngrx`

Adds NgRx support to an application or library.

**Usage:**

```bash
nx generate @nx/angular:ngrx [options]
```

**Arguments:**

```bash
nx generate @nx/angular:ngrx &lt;name&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                                                                                                                                                                                                                                                                                                                           | Default  |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--barrels`         | boolean | Use barrels to re-export actions, state and selectors.                                                                                                                                                                                                                                                                                                                                | `false`  |
| `--directory`       | string  | The name of the folder used to contain/group the generated NgRx files.                                                                                                                                                                                                                                                                                                                | `+state` |
| `--facade`          | boolean | Create a Facade class for the the feature.                                                                                                                                                                                                                                                                                                                                            | `false`  |
| `--minimal`         | boolean | Only register the root state management setup or feature state.                                                                                                                                                                                                                                                                                                                       | `true`   |
| `--module`          | string  | The path to the `NgModule` where the feature state will be registered. The host directory will create/use the new state directory.                                                                                                                                                                                                                                                    |          |
| `--parent`          | string  | The path to the file where the state will be registered. For NgModule usage, this will be your `app-module.ts` for your root state, or your Feature Module for feature state. For Standalone API usage, this will be your `app.config.ts` file for your root state, or the Routes definition file for your feature state. The host directory will create/use the new state directory. |          |
| `--root`            | boolean | Setup root or feature state management with NgRx.                                                                                                                                                                                                                                                                                                                                     | `false`  |
| `--route`           | string  | The route that the Standalone NgRx Providers should be added to.                                                                                                                                                                                                                                                                                                                      | `''`     |
| `--skipFormat`      | boolean | Skip formatting files.                                                                                                                                                                                                                                                                                                                                                                | `false`  |
| `--skipImport`      | boolean | Generate NgRx feature files without registering the feature in the NgModule.                                                                                                                                                                                                                                                                                                          | `false`  |
| `--skipPackageJson` | boolean | Do not update the `package.json` with NgRx dependencies.                                                                                                                                                                                                                                                                                                                              | `false`  |

### `ngrx-feature-store`

Add an NgRx Feature Store to an application or library.

**Usage:**

```bash
nx generate @nx/angular:ngrx-feature-store [options]
```

**Arguments:**

```bash
nx generate @nx/angular:ngrx-feature-store &lt;name&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                                                                                                                                                                                                           | Default  |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--barrels`         | boolean | Use barrels to re-export actions, state and selectors.                                                                                                                                                                                                                | `false`  |
| `--directory`       | string  | The name of the folder used to contain/group the generated NgRx files.                                                                                                                                                                                                | `+state` |
| `--facade`          | boolean | Create a Facade class for the the feature.                                                                                                                                                                                                                            | `false`  |
| `--minimal`         | boolean | Only register the feature state.                                                                                                                                                                                                                                      | `false`  |
| `--parent`          | string  | The path to the file where the state will be registered. For NgModule usage, this will be your Feature Module. For Standalone API usage, this will be your Routes definition file for your feature state. The host directory will create/use the new state directory. |          |
| `--route`           | string  | The route that the Standalone NgRx Providers should be added to.                                                                                                                                                                                                      | `''`     |
| `--skipFormat`      | boolean | Skip formatting files.                                                                                                                                                                                                                                                | `false`  |
| `--skipImport`      | boolean | Generate NgRx feature files without registering the feature in the NgModule.                                                                                                                                                                                          | `false`  |
| `--skipPackageJson` | boolean | Do not update the `package.json` with NgRx dependencies.                                                                                                                                                                                                              | `false`  |

### `ngrx-root-store`

Adds NgRx support to an application.

**Usage:**

```bash
nx generate @nx/angular:ngrx-root-store [options]
```

**Arguments:**

```bash
nx generate @nx/angular:ngrx-root-store &lt;project&gt; [options]
```

#### Options

| Option              | Type    | Description                                                                                            | Default  |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `--addDevTools`     | boolean | Instrument the Store Devtools.                                                                         | `false`  |
| `--directory`       | string  | The name of the folder used to contain/group the generated NgRx files.                                 | `+state` |
| `--facade`          | boolean | Create a Facade class for the the feature.                                                             | `false`  |
| `--minimal`         | boolean | Only register the root state management setup or also generate a global feature state.                 | `true`   |
| `--name`            | string  | Name of the NgRx state, such as `products` or `users`. Recommended to use the plural form of the name. |          |
| `--route`           | string  | The route that the Standalone NgRx Providers should be added to.                                       | `''`     |
| `--skipFormat`      | boolean | Skip formatting files.                                                                                 | `false`  |
| `--skipImport`      | boolean | Generate NgRx feature files without registering the feature in the NgModule.                           | `false`  |
| `--skipPackageJson` | boolean | Do not update the `package.json` with NgRx dependencies.                                               | `false`  |

### `pipe`

Creates an Angular pipe.

**Usage:**

```bash
nx generate @nx/angular:pipe [options]
```

**Aliases:** `p`

**Arguments:**

```bash
nx generate @nx/angular:pipe &lt;path&gt; [options]
```

#### Options

| Option            | Type    | Description                                                                                                                                                                                                                                            | Default |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--export`        | boolean | The declaring NgModule exports this pipe.                                                                                                                                                                                                              | `false` |
| `--module`        | string  | The filename of the declaring NgModule.                                                                                                                                                                                                                |         |
| `--name`          | string  | The pipe symbol name. Defaults to the last segment of the file path.                                                                                                                                                                                   |         |
| `--skipFormat`    | boolean | Skip formatting of files.                                                                                                                                                                                                                              | `false` |
| `--skipImport`    | boolean | Do not import this pipe into the owning NgModule.                                                                                                                                                                                                      | `false` |
| `--skipTests`     | boolean | Do not create "spec.ts" test files for the new pipe.                                                                                                                                                                                                   | `false` |
| `--standalone`    | boolean | Whether the generated pipe is standalone.                                                                                                                                                                                                              | `true`  |
| `--typeSeparator` | string  | The separator character to use before the type within the generated file's name. For example, if you set the option to `.`, the file will be named `example.pipe.ts`. It defaults to '-' for Angular v20+. For versions below v20, it defaults to '.'. |         |

### `remote`

Create an Angular Producer (Remote) Module Federation Application.

**Usage:**

```bash
nx generate @nx/angular:remote [options]
```

**Aliases:** `producer`

**Arguments:**

```bash
nx generate @nx/angular:remote &lt;directory&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                                                                                                                                                    | Default      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `--addTailwind`             | boolean | Whether to configure Tailwind CSS for the application.                                                                                                                                                                                                                                                         | `false`      |
| `--backendProject`          | string  | Backend project that provides data to this application. This sets up `proxy.config.json`.                                                                                                                                                                                                                      |              |
| `--bundler`                 | string  | The bundler to use for the remote application.                                                                                                                                                                                                                                                                 | `webpack`    |
| `--e2eTestRunner`           | string  | Test runner to use for end to end (E2E) tests.                                                                                                                                                                                                                                                                 | `playwright` |
| `--host`                    | string  | The name of the Consumer (host) app to attach this Producer (remote) app to.                                                                                                                                                                                                                                   |              |
| `--inlineStyle`             | boolean | Specifies if the style will be in the ts file.                                                                                                                                                                                                                                                                 | `false`      |
| `--inlineTemplate`          | boolean | Specifies if the template will be in the ts file.                                                                                                                                                                                                                                                              | `false`      |
| `--linter`                  | string  | The tool to use for running lint checks.                                                                                                                                                                                                                                                                       | `eslint`     |
| `--name`                    | string  | The name to give to the Producer (remote) Angular app.                                                                                                                                                                                                                                                         |              |
| `--port`                    | number  | The port on which this app should be served.                                                                                                                                                                                                                                                                   |              |
| `--prefix`                  | string  | The prefix to apply to generated selectors.                                                                                                                                                                                                                                                                    |              |
| `--serverRouting`           | boolean | Creates a server application using the Server Routing and App Engine APIs for application using the `application` builder (Developer Preview). _Note: this is only supported in Angular versions 19.x.x_. From Angular 20 onwards, SSR will always enable server routing when using the `application` builder. |              |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                                                                                                                                              | `false`      |
| `--skipFormat`              | boolean | Skip formatting files.                                                                                                                                                                                                                                                                                         | `false`      |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                                                                                                                                                     | `false`      |
| `--skipTests`               | boolean | Skip creating spec files.                                                                                                                                                                                                                                                                                      | `false`      |
| `--ssr`                     | boolean | Whether to configure SSR for the Producer (remote) application to be consumed by a Consumer (host) application using SSR.                                                                                                                                                                                      | `false`      |
| `--standalone`              | boolean | Whether to generate a Producer (remote) application with standalone components.                                                                                                                                                                                                                                | `true`       |
| `--strict`                  | boolean | Create an application with stricter type checking and build optimization options.                                                                                                                                                                                                                              | `true`       |
| `--style`                   | string  | The file extension to be used for style files.                                                                                                                                                                                                                                                                 | `css`        |
| `--tags`                    | string  | Add tags to the application (used for linting).                                                                                                                                                                                                                                                                |              |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS.                                                                                                                                                                                                                     | `true`       |
| `--unitTestRunner`          | string  | Test runner to use for unit tests.                                                                                                                                                                                                                                                                             | `jest`       |
| `--viewEncapsulation`       | string  | Specifies the view encapsulation strategy.                                                                                                                                                                                                                                                                     |              |

### `scam`

Creates a new Angular SCAM.

**Usage:**

```bash
nx generate @nx/angular:scam [options]
```

**Arguments:**

```bash
nx generate @nx/angular:scam &lt;path&gt; [options]
```

#### Options

| Option                | Type    | Description                                                                                                                                                                         | Default   |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `--changeDetection`   | string  | The change detection strategy to use in the new component.                                                                                                                          | `Default` |
| `--displayBlock`      | boolean | Specifies if the style will contain `:host &#123; display: block; &#125;`.                                                                                                          | `false`   |
| `--export`            | boolean | Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries.                                                        | `true`    |
| `--inlineScam`        | boolean | Create the `NgModule` in the same file as the component.                                                                                                                            | `true`    |
| `--inlineStyle`       | boolean | Include styles inline in the `component.ts` file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the `component.ts` file. | `false`   |
| `--inlineTemplate`    | boolean | Include template inline in the `component.ts` file. By default, an external template file is created and referenced in the `component.ts` file.                                     | `false`   |
| `--name`              | string  | The component symbol name. Defaults to the last segment of the file path.                                                                                                           |           |
| `--prefix`            | string  | The prefix to apply to the generated component selector.                                                                                                                            |           |
| `--selector`          | string  | The `HTML` selector to use for this component.                                                                                                                                      |           |
| `--skipFormat`        | boolean | Skip formatting files.                                                                                                                                                              | `false`   |
| `--skipSelector`      | boolean | Specifies if the component should have a selector or not.                                                                                                                           | `false`   |
| `--skipTests`         | boolean | Do not create `spec.ts` test files for the new component.                                                                                                                           | `false`   |
| `--style`             | string  | The file extension or preprocessor to use for style files, or 'none' to skip generating the style file.                                                                             | `css`     |
| `--type`              | string  | Append a custom type to the component's filename. It defaults to 'component' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified.       |           |
| `--viewEncapsulation` | string  | The view encapsulation strategy to use in the new component.                                                                                                                        |           |

### `scam-directive`

Creates a new, generic Angular directive definition in the given or default project.

**Usage:**

```bash
nx generate @nx/angular:scam-directive [options]
```

**Arguments:**

```bash
nx generate @nx/angular:scam-directive &lt;path&gt; [options]
```

#### Options

| Option         | Type    | Description                                                                                                                                                                   | Default |
| -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--export`     | boolean | Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries.                                                  | `true`  |
| `--inlineScam` | boolean | Create the `NgModule` in the same file as the Directive.                                                                                                                      | `true`  |
| `--name`       | string  | The directive symbol name. Defaults to the last segment of the file path.                                                                                                     |         |
| `--prefix`     | string  | The prefix to apply to the generated directive selector.                                                                                                                      |         |
| `--selector`   | string  | The `HTML` selector to use for this directive.                                                                                                                                |         |
| `--skipFormat` | boolean | Skip formatting files.                                                                                                                                                        | `false` |
| `--skipTests`  | boolean | Do not create `spec.ts` test files for the new directive.                                                                                                                     | `false` |
| `--type`       | string  | Append a custom type to the directive's filename. It defaults to 'directive' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified. |         |

### `scam-pipe`

Creates a new, generic Angular pipe definition in the given or default project.

**Usage:**

```bash
nx generate @nx/angular:scam-pipe [options]
```

**Arguments:**

```bash
nx generate @nx/angular:scam-pipe &lt;path&gt; [options]
```

#### Options

| Option            | Type    | Description                                                                                                                                                                                                                                            | Default |
| ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `--export`        | boolean | Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries.                                                                                                                           | `true`  |
| `--inlineScam`    | boolean | Create the NgModule in the same file as the Pipe.                                                                                                                                                                                                      | `true`  |
| `--name`          | string  | The pipe symbol name. Defaults to the last segment of the file path.                                                                                                                                                                                   |         |
| `--skipFormat`    | boolean | Skip formatting files.                                                                                                                                                                                                                                 | `false` |
| `--skipTests`     | boolean | Do not create `spec.ts` test files for the new pipe.                                                                                                                                                                                                   | `false` |
| `--typeSeparator` | string  | The separator character to use before the type within the generated file's name. For example, if you set the option to `.`, the file will be named `example.pipe.ts`. It defaults to '-' for Angular v20+. For versions below v20, it defaults to '.'. |         |

### `scam-to-standalone`

Convert an Inline SCAM to a Standalone Component.

**Usage:**

```bash
nx generate @nx/angular:scam-to-standalone [options]
```

**Arguments:**

```bash
nx generate @nx/angular:scam-to-standalone &lt;component&gt; [options]
```

#### Options

| Option         | Type    | Description                                                  | Default |
| -------------- | ------- | ------------------------------------------------------------ | ------- |
| `--project`    | string  | The project containing the SCAM.                             |         |
| `--skipFormat` | boolean | Skip formatting the workspace after the generator completes. |         |

### `setup-mf`

Create Module Federation configuration files for given Angular Application.

**Usage:**

```bash
nx generate @nx/angular:setup-mf [options]
```

**Arguments:**

```bash
nx generate @nx/angular:setup-mf &lt;appName&gt; [options]
```

#### Options

| Option                      | Type    | Description                                                                                                                                                                        | Default  |
| --------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `--mfType` **[required]**   | string  | Type of application to generate the Module Federation configuration for.                                                                                                           | `remote` |
| `--e2eProjectName`          | string  | The project name of the associated E2E project for the application. This is only required for Cypress E2E projects that do not follow the naming convention `&lt;appName&gt;-e2e`. |          |
| `--federationType`          | string  | Use either Static or Dynamic Module Federation pattern for the application.                                                                                                        | `static` |
| `--host`                    | string  | The name of the host application that the remote application will be consumed by.                                                                                                  |          |
| `--port`                    | number  | The port at which the remote application should be served.                                                                                                                         |          |
| `--prefix`                  | string  | The prefix to use for any generated component.                                                                                                                                     |          |
| `--remotes`                 | array   | A list of remote application names that the Consumer (host) application should consume.                                                                                            |          |
| `--routing`                 | boolean | Generate a routing setup to allow a Consumer (host) application to route to the Producer (remote) application.                                                                     |          |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons.                                                  | `false`  |
| `--skipE2E`                 | boolean | Do not set up E2E related config.                                                                                                                                                  | `false`  |
| `--skipFormat`              | boolean | Skip formatting the workspace after the generator completes.                                                                                                                       |          |
| `--skipPackageJson`         | boolean | Do not add dependencies to `package.json`.                                                                                                                                         | `false`  |
| `--standalone`              | boolean | Whether the application is a standalone application.                                                                                                                               | `true`   |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS.                                                                                         | `true`   |

### `setup-ssr`

Create the additional configuration required to enable SSR via Angular Universal for an Angular application.

**Usage:**

```bash
nx generate @nx/angular:setup-ssr [options]
```

**Arguments:**

```bash
nx generate @nx/angular:setup-ssr &lt;project&gt; [options]
```

#### Options

| Option                  | Type    | Description                                                                                                                                                                                                                                                                                                    | Default                |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `--hydration`           | boolean | Set up Hydration for the SSR application.                                                                                                                                                                                                                                                                      | `true`                 |
| `--main`                | string  | The name of the main entry-point file.                                                                                                                                                                                                                                                                         | `main.server.ts`       |
| `--rootModuleClassName` | string  | The name of the root module class.                                                                                                                                                                                                                                                                             | `AppServerModule`      |
| `--rootModuleFileName`  | string  | The name of the root module file                                                                                                                                                                                                                                                                               | `app.server.module.ts` |
| `--serverFileName`      | string  | The name of the Express server file.                                                                                                                                                                                                                                                                           | `server.ts`            |
| `--serverPort`          | number  | The port for the Express server.                                                                                                                                                                                                                                                                               | `4000`                 |
| `--serverRouting`       | boolean | Creates a server application using the Server Routing and App Engine APIs for application using the `application` builder (Developer Preview). _Note: this is only supported in Angular versions 19.x.x_. From Angular 20 onwards, SSR will always enable server routing when using the `application` builder. |                        |
| `--skipFormat`          | boolean | Skip formatting the workspace after the generator completes.                                                                                                                                                                                                                                                   |                        |
| `--skipPackageJson`     | boolean | Do not add dependencies to `package.json`.                                                                                                                                                                                                                                                                     | `false`                |
| `--standalone`          | boolean | Use Standalone Components to bootstrap SSR.                                                                                                                                                                                                                                                                    |                        |

### `setup-tailwind`

Adds the Tailwind CSS configuration files for a given Angular project and installs, if needed, the packages required for Tailwind CSS to work.

**Usage:**

```bash
nx generate @nx/angular:setup-tailwind [options]
```

**Arguments:**

```bash
nx generate @nx/angular:setup-tailwind &lt;project&gt; [options]
```

#### Options

| Option               | Type    | Description                                                                                                                                                                                       | Default |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `--buildTarget`      | string  | The name of the target used to build the project. This option only applies to buildable/publishable libraries.                                                                                    | `build` |
| `--skipFormat`       | boolean | Skips formatting the workspace after the generator completes.                                                                                                                                     |         |
| `--skipPackageJson`  | boolean | Do not add dependencies to `package.json`.                                                                                                                                                        | `false` |
| `--stylesEntryPoint` | string  | Path to the styles entry point relative to the workspace root. If not provided the generator will do its best to find it and it will error if it can't. This option only applies to applications. |         |

### `stories`

Creates Storybook stories/specs for all Angular components declared in a project.

**Usage:**

```bash
nx generate @nx/angular:stories [options]
```

**Arguments:**

```bash
nx generate @nx/angular:stories &lt;name&gt; [options]
```

#### Options

| Option               | Type    | Description                                  | Default                                                                   |
| -------------------- | ------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `--ignorePaths`      | array   | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests.          | `true`                                                                    |
| `--skipFormat`       | boolean | Skip formatting files.                       | `false`                                                                   |

### `storybook-configuration`

Adds Storybook configuration to a project to be able to use and create stories.

**Usage:**

```bash
nx generate @nx/angular:storybook-configuration [options]
```

**Arguments:**

```bash
nx generate @nx/angular:storybook-configuration &lt;project&gt; [options]
```

#### Options

| Option                   | Type    | Description                                                                                                                    | Default                                                                   |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `--configureStaticServe` | boolean | Specifies whether to configure a static file server target for serving storybook. Helpful for speeding up CI build/test times. | `true`                                                                    |
| `--generateStories`      | boolean | Specifies whether to automatically generate `*.stories.ts` files for components declared in this project or not.               | `true`                                                                    |
| `--ignorePaths`          | array   | Paths to ignore when looking for components.                                                                                   | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests`     | boolean | Set up Storybook interaction tests.                                                                                            | `true`                                                                    |
| `--linter`               | string  | The tool to use for running lint checks.                                                                                       | `eslint`                                                                  |
| `--skipFormat`           | boolean | Skip formatting files.                                                                                                         | `false`                                                                   |
| `--tsConfiguration`      | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js.              | `true`                                                                    |

### `web-worker`

Creates a new, generic web worker definition in the given or default project.

**Usage:**

```bash
nx generate @nx/angular:web-worker [options]
```

**Arguments:**

```bash
nx generate @nx/angular:web-worker &lt;name&gt; [options]
```

#### Options

| Option                     | Type    | Description                                                                     | Default |
| -------------------------- | ------- | ------------------------------------------------------------------------------- | ------- |
| `--project` **[required]** | string  | The name of the project.                                                        |         |
| `--path`                   | string  | The path at which to create the worker file, relative to the current workspace. |         |
| `--skipFormat`             | boolean | Skip formatting files.                                                          | `false` |
| `--snippet`                | boolean | Add a worker creation snippet in a sibling file of the same name.               | `true`  |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/angular:<generator> --help
```
