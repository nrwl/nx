
The @nx/angular plugin provides various generators to help you create and configure angular projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `application`
Creates an Angular application.

### Examples

###### Simple Application

Create an application named `my-app`:

```bash
nx g @nx/angular:application apps/my-app
```

###### Specify style extension

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```bash
nx g @nx/angular:app my-dir/my-app --style=scss
```

###### Single File Components application

Create an application with Single File Components (inline styles and inline templates):

```bash
nx g @nx/angular:app apps/my-app --inlineStyle --inlineTemplate
```

###### Set custom prefix and tags

Set the prefix to apply to generated selectors and add tags to the application (used for linting).

```bash
nx g @nx/angular:app apps/my-app --prefix=admin --tags=scope:admin,type:ui
```

**Usage:**
```bash
nx generate @nx/angular:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/angular:application <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--addTailwind` | boolean | Whether to configure Tailwind CSS for the application. | `false` |
| `--backendProject` | string | Backend project that provides data to this application. This sets up `proxy.config.json`. |  |
| `--bundler` | string | Bundler to use to build the application. | `"esbuild"` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--inlineStyle` | boolean | Specifies if the style will be in the ts file. | `false` |
| `--inlineTemplate` | boolean | Specifies if the template will be in the ts file. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--minimal` | boolean | Generate a Angular app with a minimal setup. | `false` |
| `--name` | string | The name of the application. |  |
| `--port` | number | The port at which the remote application should be served. |  |
| `--prefix` | string | The prefix to apply to generated selectors. | `"app"` |
| `--rootProject` | boolean | Create an application at the root of the workspace. | `false` |
| `--routing` | boolean | Enable routing for the application. | `true` |
| `--serverRouting` | boolean | Creates a server application using the Server Routing and App Engine APIs for application using the `application` builder (Developer Preview). _Note: this is only supported in Angular versions 19.x.x_. From Angular 20 onwards, SSR will always enable server routing when using the `application` builder. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipTests` | boolean | Skip creating spec files. | `false` |
| `--ssr` | boolean | Creates an application with Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering) enabled. | `false` |
| `--standalone` | boolean | Generate an application that is setup to use standalone components. | `true` |
| `--strict` | boolean | Create an application with stricter type checking and build optimization options. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. `vitest-angular` uses the `@angular/build:unit-test` executor (requires Angular v21+ and the `esbuild` bundler). `vitest-analog` uses AnalogJS-based setup with `@nx/vitest`. It defaults to `vitest-angular` when using the `esbuild` bundler for Angular versions >= 21.0.0, `vitest-analog` when using other bundlers on Angular >= 21.0.0, otherwise `jest`. |  |
| `--viewEncapsulation` | string | Specifies the view encapsulation strategy. |  |
| `--zoneless` | boolean | Generate an application that does not use `zone.js`. It defaults to `true`. _Note: this is only supported in Angular versions >= 21.0.0_ |  |

## `component`
Creates a new Angular component.

### Examples

###### Simple Component

Generate a component named `Card` at `apps/my-app/src/lib/card/card.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card.ts
```

###### Without Providing the File Extension

Generate a component named `Card` at `apps/my-app/src/lib/card/card.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card
```

###### With Different Symbol Name

Generate a component named `Custom` at `apps/my-app/src/lib/card/card.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --name=custom
```

###### With a Component Type

Generate a component named `CardComponent` at `apps/my-app/src/lib/card/card.component.ts`:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --type=component
```

###### Single File Component

Create a component named `Card` with inline styles and inline template:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --inlineStyle --inlineTemplate
```

###### Component with OnPush Change Detection Strategy

Create a component named `Card` with `OnPush` Change Detection Strategy:

```bash
nx g @nx/angular:component apps/my-app/src/lib/card/card --changeDetection=OnPush
```

**Usage:**
```bash
nx generate @nx/angular:component [options]
```

**Aliases:** `c`

**Arguments:**
```bash
nx generate @nx/angular:component <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--changeDetection` | string | The change detection strategy to use in the new component. | `"Default"` |
| `--displayBlock` | boolean | Specifies if the style will contain `:host { display: block; }`. | `false` |
| `--export` | boolean | Specifies if the component should be exported in the declaring `NgModule`. Additionally, if the project is a library, the component will be exported from the project's entry point (normally `index.ts`) if the module it belongs to is also exported or if the component is standalone. | `false` |
| `--exportDefault` | boolean | Use default export for the component instead of a named export. | `false` |
| `--inlineStyle` | boolean | Include styles inline in the component.ts file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the component.ts file. | `false` |
| `--inlineTemplate` | boolean | Include template inline in the component.ts file. By default, an external template file is created and referenced in the component.ts file. | `false` |
| `--module` | string | The filename or path to the NgModule that will declare this component. |  |
| `--name` | string | The component symbol name. Defaults to the last segment of the file path. |  |
| `--ngHtml` | boolean | Generate component template files with an '.ng.html' file extension instead of '.html'. | `false` |
| `--prefix` | string | The prefix to apply to the generated component selector. |  |
| `--selector` | string | The HTML selector to use for this component. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipImport` | boolean | Do not import this component into the owning NgModule. | `false` |
| `--skipSelector` | boolean | Specifies if the component should have a selector or not. | `false` |
| `--skipTests` | boolean | Do not create `spec.ts` test files for the new component. | `false` |
| `--standalone` | boolean | Whether the generated component is standalone. | `true` |
| `--style` | string | The file extension or preprocessor to use for style files, or `none` to skip generating the style file. | `"css"` |
| `--type` | string | Append a custom type to the component's filename. It defaults to 'component' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified. |  |
| `--viewEncapsulation` | string | The view encapsulation strategy to use in the new component. |  |

## `component-test`
Create a `*.cy.ts` file for Cypress component testing for an Angular component.

### Examples

:::caution[Can I use component testing?]
Angular component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).
:::

This generator is used to create a Cypress component test file for a given Angular component.

```shell
nx g @nx/angular:component-test --project=my-cool-angular-project --componentName=CoolBtnComponent --componentDir=src/cool-btn --componentFileName=cool-btn.component
```

Test file are generated with the `.cy.ts` suffix. this is to prevent colliding with any existing `.spec.` files contained in the project.

It's currently expected the generated `.cy.ts` file will live side by side with the component. It is also assumed the project is already setup for component testing. If it isn't, then you can run the [cypress-component-project generator](/nx-api/angular/generators/cypress-component-configuration) to set up the project for component testing.

**Usage:**
```bash
nx generate @nx/angular:component-test [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--componentDir` | string [**required**] | Relative path to the folder that contains the component from the project root. |  |
| `--componentFileName` | string [**required**] | File name that contains the component without the `.ts` extension. |  |
| `--componentName` | string [**required**] | Class name of the component to create a test for. |  |
| `--project` | string [**required**] | The name of the project where the component is located. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |

## `convert-to-application-executor`
Converts a project or all projects using one of the `@angular-devkit/build-angular:browser`, `@angular-devkit/build-angular:browser-esbuild`, `@nx/angular:browser` and `@nx/angular:browser-esbuild` executors to use the `@nx/angular:application` executor or the `@angular-devkit/build-angular:application` builder. If the converted target is using one of the `@nx/angular` executors, the `@nx/angular:application` executor will be used. Otherwise, the `@angular-devkit/build-angular:application` builder will be used.

**Usage:**
```bash
nx generate @nx/angular:convert-to-application-executor [options]
```

**Arguments:**
```bash
nx generate @nx/angular:convert-to-application-executor <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `convert-to-rspack`
Creates an Angular application.

**Usage:**
```bash
nx generate @nx/angular:convert-to-rspack [options]
```

**Arguments:**
```bash
nx generate @nx/angular:convert-to-rspack <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipInstall` | boolean | Skip installing dependencies. | `false` |

## `convert-to-with-mf`
Converts an old micro frontend configuration to use the new withModuleFederation helper. It will run successfully if the following conditions are met: 
 - Is either a host or remote application 
 - Shared npm package configurations have not been modified 
 - Name used to identify the Micro Frontend application matches the project name 

{% callout type="warning" title="Overrides" %}This generator will overwrite your webpack config. If you have additional custom configuration in your config file, it will be lost!{% /callout %}.

**Usage:**
```bash
nx generate @nx/angular:convert-to-with-mf [options]
```

**Arguments:**
```bash
nx generate @nx/angular:convert-to-with-mf <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `cypress-component-configuration`
Add a Cypress component testing configuration to an existing project. Cypress v10.7.0 or higher is required.

:::caution[Can I use component testing?]
Angular component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you want to test components via Storybook with Cypress, then check out the [storybook-configuration generator docs](/nx-api/angular/generators/storybook-configuration). However, this functionality is deprecated, and will be removed on Nx version 18.
:::

This generator is designed to get your Angular project up and running with Cypress Component Testing.

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project
```

Running this generator, adds the required files to the specified project with a preconfigured `cypress.config.ts` designed for Nx workspaces.

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
```

Here is an example on how to add custom options to the configuration

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // extra options here
  },
});
```

### Specifying a Build Target

Component testing requires a _build target_ to correctly run the component test dev server. This option can be manually specified with `--build-target=some-angular-app:build`, but Nx will infer this usage from the [project graph](/concepts/mental-model#the-project-graph) if one isn't provided.

For Angular projects, the build target needs to be using the `@nx/angular:webpack-browser` or
`@angular-devkit/build-angular:browser` executor.
The generator will throw an error if a build target can't be found and suggest passing one in manually.

Letting Nx infer the build target by default

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project
```

Manually specifying the build target

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project --build-target:some-angular-app:build --generate-tests
```

:::note[Build Target with Configuration]
If you're wanting to use a build target with a specific configuration. i.e. `my-app:build:production`,
then manually providing `--build-target=my-app:build:production` is the best way to do that.
:::

### Auto Generating Tests

You can optionally use the `--generate-tests` flag to generate a test file for each component in your project.

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project --generate-tests
```

### Running Component Tests

A new `component-test` target will be added to the specified project to run your component tests.

```shell
nx g component-test my-cool-angular-project
```

Here is an example of the project configuration that is generated. The `--build-target` option is added as the `devServerTarget` which can be changed as needed.

```json title="project.json"
{
  "targets" {
    "component-test": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "<path-to-project-root>/cypress.config.ts",
        "testingType": "component",
        "devServerTarget": "some-angular-app:build",
        "skipServe": true
      }
    }
  }
}
```

### What is bundled

When the project being tested is a dependent of the specified `--build-target`, then **assets, scripts, and styles** are applied to the component being tested. You can determine if the project is dependent by using the [project graph](/features/explore-graph). If there is no link between the two projects, then the **assets, scripts, and styles** won't be included in the build; therefore, they will not be applied to the component. To have a link between projects, you can import from the project being tested into the specified `--build-target` project, or set the `--build-target` project to [implicitly depend](/reference/project-configuration#implicitdependencies) on the project being tested.

Nx also supports [React component testing](/nx-api/react/generators/cypress-component-configuration).

**Usage:**
```bash
nx generate @nx/angular:cypress-component-configuration [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project to add cypress component testing configuration to |  |
| `--buildTarget` | string | A build target used to configure Cypress component testing in the format of `project:target[:configuration]`. The build target should be an angular app. If not provided we will try to infer it from your projects usage. |  |
| `--generateTests` | boolean | Generate default component tests for existing components in the project | `false` |
| `--skipFormat` | boolean | Skip formatting files | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |

## `directive`
Creates a new Angular directive.

**Usage:**
```bash
nx generate @nx/angular:directive [options]
```

**Aliases:** `d`

**Arguments:**
```bash
nx generate @nx/angular:directive <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | The declaring NgModule exports this directive. | `false` |
| `--module` | string | The filename of the declaring NgModule. |  |
| `--name` | string | The directive symbol name. Defaults to the last segment of the file path. |  |
| `--prefix` | string | A prefix to apply to generated selectors. |  |
| `--selector` | string | The HTML selector to use for this directive. |  |
| `--skipFormat` | boolean | Skip formatting of files. | `false` |
| `--skipImport` | boolean | Do not import this directive into the owning NgModule. | `false` |
| `--skipTests` | boolean | Do not create "spec.ts" test files for the new class. | `false` |
| `--standalone` | boolean | Whether the generated directive is standalone. | `true` |
| `--type` | string | Append a custom type to the directive's filename. It defaults to 'directive' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified. |  |

## `federate-module`
Create a federated module, which is exposed by a Producer (remote) and can be subsequently loaded by a Consumer (host).

**Usage:**
```bash
nx generate @nx/angular:federate-module [options]
```

**Arguments:**
```bash
nx generate @nx/angular:federate-module <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--name` | string [**required**] | The name of the module. |  |
| `--remote` | string [**required**] | The name of the Producer (remote). |  |
| `--e2eTestRunner` | string | Test runner to use for end to end (e2e) tests of the Producer (remote) if it needs to be created. | `"cypress"` |
| `--host` | string | The Consumer (host) application for this Producer (remote). |  |
| `--remoteDirectory` | string | The directory of the new Producer (remote) application if one needs to be created. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--standalone` | boolean | Whether to generate the Producer (remote) application with standalone components if it needs to be created. | `true` |
| `--style` | string | The file extension to be used for style files for the Producer (remote) if one needs to be created. | `"css"` |
| `--unitTestRunner` | string | Test runner to use for unit tests of the Producer (remote) if it needs to be created. `vitest-analog` uses AnalogJS-based setup with `@nx/vitest`. It defaults to `vitest-analog` for Angular versions >= 21.0.0, otherwise `jest`. |  |

## `host`
Create an Angular Consumer (Host) Module Federation Application.

**Usage:**
```bash
nx generate @nx/angular:host [options]
```

**Aliases:** `consumer`

**Arguments:**
```bash
nx generate @nx/angular:host <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--addTailwind` | boolean | Whether to configure Tailwind CSS for the application. | `false` |
| `--backendProject` | string | Backend project that provides data to this application. This sets up `proxy.config.json`. |  |
| `--bundler` | string | The bundler to use for the host application. | `"webpack"` |
| `--dynamic` | boolean | Should the host application use dynamic federation? | `false` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--inlineStyle` | boolean | Specifies if the style will be in the ts file. | `false` |
| `--inlineTemplate` | boolean | Specifies if the template will be in the ts file. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--name` | string | The name to give to the Consumer (host) Angular application. |  |
| `--prefix` | string | The prefix to apply to generated selectors. |  |
| `--remotes` | array | The names of the Producers (remote) applications to add to the Consumer (host). |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipPostInstall` | boolean | Do not add or append `ngcc` to the `postinstall` script in `package.json`. | `false` |
| `--skipTests` | boolean | Skip creating spec files. | `false` |
| `--ssr` | boolean | Whether to configure SSR for the Consumer (host) application | `false` |
| `--standalone` | boolean | Whether to generate a Consumer (host) application that uses standalone components. | `true` |
| `--strict` | boolean | Create an application with stricter type checking and build optimization options. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. | `true` |
| `--unitTestRunner` | string | Test runner to use for unit tests. `vitest-analog` uses AnalogJS-based setup with `@nx/vitest`. It defaults to `vitest-analog` for Angular versions >= 21.0.0, otherwise `jest`. |  |
| `--viewEncapsulation` | string | Specifies the view encapsulation strategy. |  |
| `--zoneless` | boolean | Generate an application that does not use `zone.js`. It defaults to `true`. _Note: this is only supported in Angular versions >= 21.0.0_ |  |

## `library`
Creates an Angular library.

### Examples

###### Simple Library

Creates the `my-ui-lib` library with an `ui` tag:

```bash
nx g @nx/angular:library libs/my-ui-lib --tags=ui
```

###### Publishable Library

Creates the `my-lib` library that can be built producing an output following the Angular Package Format (APF) to be distributed as an NPM package:

```bash
nx g @nx/angular:library libs/my-lib --publishable --import-path=@my-org/my-lib
```

###### Buildable Library

Creates the `my-lib` library with support for incremental builds:

```bash
nx g @nx/angular:library libs/my-lib --buildable
```

###### Nested Folder & Import

Creates the `my-lib` library in the `nested` directory and sets the import path to `@myorg/nested/my-lib`:

```bash
nx g @nx/angular:library libs/nested/my-lib --importPath=@myorg/nested/my-lib
```

**Usage:**
```bash
nx generate @nx/angular:library [options]
```

**Aliases:** `lib`

**Arguments:**
```bash
nx generate @nx/angular:library <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--addModuleSpec` | boolean | Add a module spec file. | `false` |
| `--addTailwind` | boolean | Whether to configure Tailwind CSS for the application. It can only be used with buildable and publishable libraries. Non-buildable libraries will use the application's Tailwind configuration. | `false` |
| `--buildable` | boolean | Generate a buildable library. | `false` |
| `--changeDetection` | string | The change detection strategy to use in the new component. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `"Default"` |
| `--compilationMode` | string | Specifies the compilation mode to use. If not specified, it will default to `partial` for publishable libraries and to `full` for buildable libraries. The `full` value can not be used for publishable libraries. |  |
| `--displayBlock` | boolean | Specifies if the component generated style will contain `:host { display: block; }`. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false` |
| `--flat` | boolean | Ensure the generated standalone component is not placed in a subdirectory. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false` |
| `--importPath` | string | The library name used to import it, like `@myorg/my-awesome-lib`. Must be a valid npm name. |  |
| `--inlineStyle` | boolean | Include styles inline in the component.ts file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the component.ts file. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false` |
| `--inlineTemplate` | boolean | Include template inline in the component.ts file. By default, an external template file is created and referenced in the component.ts file. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false` |
| `--lazy` | boolean | Add `RouterModule.forChild` when set to true, and a simple array of routes when set to false. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--name` | string | The name of the library. |  |
| `--parent` | string | Path to the parent route configuration using `loadChildren` or `children`, depending on what `lazy` is set to. |  |
| `--prefix` | string | The prefix to apply to generated selectors. |  |
| `--publishable` | boolean | Generate a publishable library. | `false` |
| `--routing` | boolean | Add router configuration. See `lazy` for more information. | `false` |
| `--selector` | string | The HTML selector to use for this component. Disclaimer: This option is only valid when `--standalone` is set to `true`. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipModule` | boolean | Whether to skip the creation of a default module when generating the library. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipSelector` | boolean | Specifies if the component should have a selector or not. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false` |
| `--skipTests` | boolean | Do not create `spec.ts` test files for the new component. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `false` |
| `--skipTsConfig` | boolean | Do not update `tsconfig.json` for development experience. | `false` |
| `--standalone` | boolean | Generate a library that uses a standalone component instead of a module as the entry point. | `true` |
| `--strict` | boolean | Create a library with stricter type checking and build optimization options. | `true` |
| `--style` | string | The file extension or preprocessor to use for style files, or `none` to skip generating the style file. Disclaimer: This option is only valid when `--standalone` is set to `true`. | `"css"` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. `vitest-angular` uses the `@nx/angular:unit-test` executor (requires Angular v21+ and a buildable/publishable library). `vitest-analog` uses AnalogJS-based setup with `@nx/vitest`. It defaults to `vitest-angular` for buildable/publishable libraries on Angular >= 21.0.0, `vitest-analog` for non-buildable libraries on Angular >= 21.0.0, otherwise `jest`. |  |
| `--viewEncapsulation` | string | The view encapsulation strategy to use in the new component. Disclaimer: This option is only valid when `--standalone` is set to `true`. |  |

## `library-secondary-entry-point`
Creates a secondary entry point for an Angular publishable library.

### Examples

###### Basic Usage

Create a secondary entrypoint named `button` in the `ui` library.

```bash
nx g @nx/angular:library-secondary-entry-point --library=ui --name=button
```

###### Skip generating module

Create a secondary entrypoint named `button` in the `ui` library but skip creating an NgModule.

```bash
nx g @nx/angular:library-secondary-entry-point --library=ui --name=button --skipModule
```

**Usage:**
```bash
nx generate @nx/angular:library-secondary-entry-point [options]
```

**Aliases:** `secondary-entry-point`, `entry-point`

**Arguments:**
```bash
nx generate @nx/angular:library-secondary-entry-point <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--library` | string [**required**] | The name of the library to create the secondary entry point for. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipModule` | boolean | Skip generating a module for the secondary entry point. | `false` |

## `move`
Move an Angular project to another folder in the workspace.

**Usage:**
```bash
nx generate @nx/angular:move [options]
```

**Aliases:** `mv`

**Arguments:**
```bash
nx generate @nx/angular:move <destination> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--projectName` | string [**required**] | The name of the Angular project to move. |  |
| `--importPath` | string | The new import path to use in the `tsconfig.base.json`. |  |
| `--newProjectName` | string | The new name of the project after the move. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--updateImportPath` | boolean | Update the import path to reflect the new location. | `true` |

## `ngrx`
Adds NgRx support to an application or library.

**Usage:**
```bash
nx generate @nx/angular:ngrx [options]
```

**Arguments:**
```bash
nx generate @nx/angular:ngrx <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--barrels` | boolean | Use barrels to re-export actions, state and selectors. | `false` |
| `--directory` | string | The name of the folder used to contain/group the generated NgRx files. | `"+state"` |
| `--facade` | boolean | Create a Facade class for the the feature. | `false` |
| `--minimal` | boolean | Only register the root state management setup or feature state. | `true` |
| `--module` | string | The path to the `NgModule` where the feature state will be registered. The host directory will create/use the new state directory. |  |
| `--parent` | string | The path to the file where the state will be registered. For NgModule usage, this will be your `app-module.ts` for your root state, or your Feature Module for feature state. For Standalone API usage, this will be your `app.config.ts` file for your root state, or the Routes definition file for your feature state. The host directory will create/use the new state directory. |  |
| `--root` | boolean | Setup root or feature state management with NgRx. | `false` |
| `--route` | string | The route that the Standalone NgRx Providers should be added to. | `"''"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipImport` | boolean | Generate NgRx feature files without registering the feature in the NgModule. | `false` |
| `--skipPackageJson` | boolean | Do not update the `package.json` with NgRx dependencies. | `false` |

## `ngrx-feature-store`
Add an NgRx Feature Store to an application or library.

**Usage:**
```bash
nx generate @nx/angular:ngrx-feature-store [options]
```

**Arguments:**
```bash
nx generate @nx/angular:ngrx-feature-store <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--barrels` | boolean | Use barrels to re-export actions, state and selectors. | `false` |
| `--directory` | string | The name of the folder used to contain/group the generated NgRx files. | `"+state"` |
| `--facade` | boolean | Create a Facade class for the the feature. | `false` |
| `--minimal` | boolean | Only register the feature state. | `false` |
| `--parent` | string | The path to the file where the state will be registered. For NgModule usage, this will be your Feature Module. For Standalone API usage, this will be your Routes definition file for your feature state. The host directory will create/use the new state directory. |  |
| `--route` | string | The route that the Standalone NgRx Providers should be added to. | `"''"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipImport` | boolean | Generate NgRx feature files without registering the feature in the NgModule. | `false` |
| `--skipPackageJson` | boolean | Do not update the `package.json` with NgRx dependencies. | `false` |

## `ngrx-root-store`
Adds NgRx support to an application.

**Usage:**
```bash
nx generate @nx/angular:ngrx-root-store [options]
```

**Arguments:**
```bash
nx generate @nx/angular:ngrx-root-store <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--addDevTools` | boolean | Instrument the Store Devtools. | `false` |
| `--directory` | string | The name of the folder used to contain/group the generated NgRx files. | `"+state"` |
| `--facade` | boolean | Create a Facade class for the the feature. | `false` |
| `--minimal` | boolean | Only register the root state management setup or also generate a global feature state. | `true` |
| `--name` | string | Name of the NgRx state, such as `products` or `users`. Recommended to use the plural form of the name. |  |
| `--route` | string | The route that the Standalone NgRx Providers should be added to. | `"''"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipImport` | boolean | Generate NgRx feature files without registering the feature in the NgModule. | `false` |
| `--skipPackageJson` | boolean | Do not update the `package.json` with NgRx dependencies. | `false` |

## `pipe`
Creates an Angular pipe.

**Usage:**
```bash
nx generate @nx/angular:pipe [options]
```

**Aliases:** `p`

**Arguments:**
```bash
nx generate @nx/angular:pipe <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | The declaring NgModule exports this pipe. | `false` |
| `--module` | string | The filename of the declaring NgModule. |  |
| `--name` | string | The pipe symbol name. Defaults to the last segment of the file path. |  |
| `--skipFormat` | boolean | Skip formatting of files. | `false` |
| `--skipImport` | boolean | Do not import this pipe into the owning NgModule. | `false` |
| `--skipTests` | boolean | Do not create "spec.ts" test files for the new pipe. | `false` |
| `--standalone` | boolean | Whether the generated pipe is standalone. | `true` |
| `--typeSeparator` | string | The separator character to use before the type within the generated file's name. For example, if you set the option to `.`, the file will be named `example.pipe.ts`. It defaults to '-' for Angular v20+. For versions below v20, it defaults to '.'. |  |

## `remote`
Create an Angular Producer (Remote) Module Federation Application.

**Usage:**
```bash
nx generate @nx/angular:remote [options]
```

**Aliases:** `producer`

**Arguments:**
```bash
nx generate @nx/angular:remote <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--addTailwind` | boolean | Whether to configure Tailwind CSS for the application. | `false` |
| `--backendProject` | string | Backend project that provides data to this application. This sets up `proxy.config.json`. |  |
| `--bundler` | string | The bundler to use for the remote application. | `"webpack"` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--host` | string | The name of the Consumer (host) app to attach this Producer (remote) app to. |  |
| `--inlineStyle` | boolean | Specifies if the style will be in the ts file. | `false` |
| `--inlineTemplate` | boolean | Specifies if the template will be in the ts file. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--name` | string | The name to give to the Producer (remote) Angular app. |  |
| `--port` | number | The port on which this app should be served. |  |
| `--prefix` | string | The prefix to apply to generated selectors. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipTests` | boolean | Skip creating spec files. | `false` |
| `--ssr` | boolean | Whether to configure SSR for the Producer (remote) application to be consumed by a Consumer (host) application using SSR. | `false` |
| `--standalone` | boolean | Whether to generate a Producer (remote) application with standalone components. | `true` |
| `--strict` | boolean | Create an application with stricter type checking and build optimization options. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. | `true` |
| `--unitTestRunner` | string | Test runner to use for unit tests. `vitest-analog` uses AnalogJS-based setup with `@nx/vitest`. It defaults to `vitest-analog` for Angular versions >= 21.0.0, otherwise `jest`. |  |
| `--viewEncapsulation` | string | Specifies the view encapsulation strategy. |  |
| `--zoneless` | boolean | Generate an application that does not use `zone.js`. It defaults to `true`. _Note: this is only supported in Angular versions >= 21.0.0_ |  |

## `scam`
Creates a new Angular SCAM.

**Usage:**
```bash
nx generate @nx/angular:scam [options]
```

**Arguments:**
```bash
nx generate @nx/angular:scam <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--changeDetection` | string | The change detection strategy to use in the new component. | `"Default"` |
| `--displayBlock` | boolean | Specifies if the style will contain `:host { display: block; }`. | `false` |
| `--export` | boolean | Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries. | `true` |
| `--inlineScam` | boolean | Create the `NgModule` in the same file as the component. | `true` |
| `--inlineStyle` | boolean | Include styles inline in the `component.ts` file. Only CSS styles can be included inline. By default, an external styles file is created and referenced in the `component.ts` file. | `false` |
| `--inlineTemplate` | boolean | Include template inline in the `component.ts` file. By default, an external template file is created and referenced in the `component.ts` file. | `false` |
| `--name` | string | The component symbol name. Defaults to the last segment of the file path. |  |
| `--prefix` | string | The prefix to apply to the generated component selector. |  |
| `--selector` | string | The `HTML` selector to use for this component. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipSelector` | boolean | Specifies if the component should have a selector or not. | `false` |
| `--skipTests` | boolean | Do not create `spec.ts` test files for the new component. | `false` |
| `--style` | string | The file extension or preprocessor to use for style files, or 'none' to skip generating the style file. | `"css"` |
| `--type` | string | Append a custom type to the component's filename. It defaults to 'component' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified. |  |
| `--viewEncapsulation` | string | The view encapsulation strategy to use in the new component. |  |

## `scam-directive`
Creates a new, generic Angular directive definition in the given or default project.

**Usage:**
```bash
nx generate @nx/angular:scam-directive [options]
```

**Arguments:**
```bash
nx generate @nx/angular:scam-directive <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries. | `true` |
| `--inlineScam` | boolean | Create the `NgModule` in the same file as the Directive. | `true` |
| `--name` | string | The directive symbol name. Defaults to the last segment of the file path. |  |
| `--prefix` | string | The prefix to apply to the generated directive selector. |  |
| `--selector` | string | The `HTML` selector to use for this directive. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipTests` | boolean | Do not create `spec.ts` test files for the new directive. | `false` |
| `--type` | string | Append a custom type to the directive's filename. It defaults to 'directive' for Angular versions below v20. For Angular v20 and above, no type is appended unless specified. |  |

## `scam-pipe`
Creates a new, generic Angular pipe definition in the given or default project.

**Usage:**
```bash
nx generate @nx/angular:scam-pipe [options]
```

**Arguments:**
```bash
nx generate @nx/angular:scam-pipe <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | Specifies if the SCAM should be exported from the project's entry point (normally `index.ts`). It only applies to libraries. | `true` |
| `--inlineScam` | boolean | Create the NgModule in the same file as the Pipe. | `true` |
| `--name` | string | The pipe symbol name. Defaults to the last segment of the file path. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipTests` | boolean | Do not create `spec.ts` test files for the new pipe. | `false` |
| `--typeSeparator` | string | The separator character to use before the type within the generated file's name. For example, if you set the option to `.`, the file will be named `example.pipe.ts`. It defaults to '-' for Angular v20+. For versions below v20, it defaults to '.'. |  |

## `scam-to-standalone`
Convert an Inline SCAM to a Standalone Component.

### Examples

###### Basic Usage

This generator allows you to convert an Inline SCAM to a Standalone Component. It's important that the SCAM you wish to convert has it's NgModule within the same file for the generator to be able to correctly convert the component to Standalone.

```bash

nx g @nx/angular:scam-to-standalone --component=libs/mylib/src/lib/myscam/myscam.ts --project=mylib

```

**Usage:**
```bash
nx generate @nx/angular:scam-to-standalone [options]
```

**Arguments:**
```bash
nx generate @nx/angular:scam-to-standalone <component> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project containing the SCAM. |  |
| `--skipFormat` | boolean | Skip formatting the workspace after the generator completes. |  |

## `setup-mf`
Create Module Federation configuration files for given Angular Application.

### Examples

The `setup-mf` generator is used to add Module Federation support to existing applications.

###### Convert to Host

To convert an existing application to a host application, run the following

```bash
nx g setup-mf myapp --mfType=host --routing=true
```

###### Convert to Remote

To convert an existing application to a remote application, run the following

```bash
nx g setup-mf myapp --mfType=remote --routing=true
```

###### Convert to Remote and attach to a host application

To convert an existing application to a remote application and attach it to an existing host application name `myhostapp`, run the following

```bash
nx g setup-mf myapp --mfType=remote --routing=true --host=myhostapp
```

###### Convert to Host and attach to existing remote applications

To convert an existing application to a host application and attaching existing remote applications named `remote1` and `remote2`, run the following

```bash
nx g setup-mf myapp --mfType=host --routing=true --remotes=remote1,remote2
```

**Usage:**
```bash
nx generate @nx/angular:setup-mf [options]
```

**Arguments:**
```bash
nx generate @nx/angular:setup-mf <appName> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--mfType` | string [**required**] | Type of application to generate the Module Federation configuration for. | `"remote"` |
| `--e2eProjectName` | string | The project name of the associated E2E project for the application. This is only required for Cypress E2E projects that do not follow the naming convention `<appName>-e2e`. |  |
| `--federationType` | string | Use either Static or Dynamic Module Federation pattern for the application. | `"static"` |
| `--host` | string | The name of the host application that the remote application will be consumed by. |  |
| `--port` | number | The port at which the remote application should be served. |  |
| `--prefix` | string | The prefix to use for any generated component. |  |
| `--remotes` | array | A list of remote application names that the Consumer (host) application should consume. |  |
| `--routing` | boolean | Generate a routing setup to allow a Consumer (host) application to route to the Producer (remote) application. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipE2E` | boolean | Do not set up E2E related config. | `false` |
| `--skipFormat` | boolean | Skip formatting the workspace after the generator completes. |  |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--standalone` | boolean | Whether the application is a standalone application. | `true` |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. | `true` |

## `setup-ssr`
Create the additional configuration required to enable SSR via Angular Universal for an Angular application.

**Usage:**
```bash
nx generate @nx/angular:setup-ssr [options]
```

**Arguments:**
```bash
nx generate @nx/angular:setup-ssr <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--hydration` | boolean | Set up Hydration for the SSR application. | `true` |
| `--main` | string | The name of the main entry-point file. | `"main.server.ts"` |
| `--rootModuleClassName` | string | The name of the root module class. | `"AppServerModule"` |
| `--rootModuleFileName` | string | The name of the root module file | `"app.server.module.ts"` |
| `--serverFileName` | string | The name of the Express server file. | `"server.ts"` |
| `--serverPort` | number | The port for the Express server. | `4000` |
| `--serverRouting` | boolean | Creates a server application using the Server Routing and App Engine APIs for application using the `application` builder (Developer Preview). _Note: this is only supported in Angular versions 19.x.x_. From Angular 20 onwards, SSR will always enable server routing when using the `application` builder. |  |
| `--skipFormat` | boolean | Skip formatting the workspace after the generator completes. |  |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--standalone` | boolean | Use Standalone Components to bootstrap SSR. |  |

## `setup-tailwind`
Adds the Tailwind CSS configuration files for a given Angular project and installs, if needed, the packages required for Tailwind CSS to work.

### Examples

The `setup-tailwind` generator can be used to add [Tailwind](https://tailwindcss.com) configuration to apps and publishable libraries.

###### Standard Setup

To generate a standard Tailwind setup, just run the following command.

```bash
nx g @nx/angular:setup-tailwind myapp
```

###### Specifying the Styles Entrypoint

To specify the styles file that should be used as the entrypoint for Tailwind, simply pass the `--stylesEntryPoint` flag, relative to workspace root.

```bash
nx g @nx/angular:setup-tailwind myapp --stylesEntryPoint=apps/myapp/src/styles.css
```

**Usage:**
```bash
nx generate @nx/angular:setup-tailwind [options]
```

**Arguments:**
```bash
nx generate @nx/angular:setup-tailwind <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--buildTarget` | string | The name of the target used to build the project. This option only applies to buildable/publishable libraries. | `"build"` |
| `--skipFormat` | boolean | Skips formatting the workspace after the generator completes. |  |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--stylesEntryPoint` | string | Path to the styles entry point relative to the workspace root. If not provided the generator will do its best to find it and it will error if it can't. This option only applies to applications. |  |

## `stories`
Creates Storybook stories/specs for all Angular components declared in a project.

This generator will generate stories for all your components in your project. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```bash
nx g @nx/angular:stories project-name
```

You can read more about how this generator works, in the [Storybook for Angular overview page](/recipes/storybook/overview-angular#auto-generate-stories).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests).

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

### Examples

#### Ignore certain paths when generating stories

```bash
nx g @nx/angular:stories ui --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*
```

This will generate stories for all the components in the `ui` project, except for the ones in the `libs/ui/src/not-stories` directory, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

**Usage:**
```bash
nx generate @nx/angular:stories [options]
```

**Arguments:**
```bash
nx generate @nx/angular:stories <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--ignorePaths` | array | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `storybook-configuration`
Adds Storybook configuration to a project to be able to use and create stories.

This generator will set up Storybook for your **Angular** project. By default, Storybook v10 is used.

```bash
nx g @nx/angular:storybook-configuration project-name
```

You can read more about how this generator works, in the [Storybook for Angular overview page](/recipes/storybook/overview-angular#generate-storybook-configuration-for-an-angular-project).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. Also, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/angular/writing-tests/test-runner). You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests).
- Whether you want to `generateStories` for the components in your project. If you choose `yes`, a `.stories.ts` file will be generated next to each of your components in your project.

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

### Examples

#### Generate Storybook configuration

```bash
nx g @nx/angular:storybook-configuration ui
```

This will generate Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory, eg. `.storybook/main.ts`).

#### Ignore certain paths when generating stories

```bash
nx g @nx/angular:storybook-configuration ui --generateStories=true --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*,apps/my-app/**/*.something.ts
```

This will generate a Storybook configuration for the `ui` project and generate stories for all components in the `libs/ui/src/lib` directory, except for the ones in the `libs/ui/src/not-stories` directory, and the ones in the `apps/my-app` directory that end with `.something.ts`, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

#### Generate Storybook configuration using JavaScript

```bash
nx g @nx/angular:storybook-configuration ui --tsConfiguration=false
```

By default, our generator generates TypeScript Storybook configuration files. You can choose to use JavaScript for the Storybook configuration files of your project (the files inside the `.storybook` directory, eg. `.storybook/main.js`).

**Usage:**
```bash
nx generate @nx/angular:storybook-configuration [options]
```

**Arguments:**
```bash
nx generate @nx/angular:storybook-configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--configureStaticServe` | boolean | Specifies whether to configure a static file server target for serving storybook. Helpful for speeding up CI build/test times. | `true` |
| `--generateStories` | boolean | Specifies whether to automatically generate `*.stories.ts` files for components declared in this project or not. | `true` |
| `--ignorePaths` | array | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--tsConfiguration` | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js. | `true` |

## `web-worker`
Creates a new, generic web worker definition in the given or default project.

### Examples

###### Simple Usage

The basic usage of the `web-worker` generator is defined below. You must provide a name for the web worker and the project to assign it to.

```bash
nx g @nx/angular:web-worker myWebWorker --project=myapp
```

**Usage:**
```bash
nx generate @nx/angular:web-worker [options]
```

**Arguments:**
```bash
nx generate @nx/angular:web-worker <name> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project. |  |
| `--path` | string | The path at which to create the worker file, relative to the current workspace. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--snippet` | boolean | Add a worker creation snippet in a sibling file of the same name. | `true` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/angular:<generator> --help
```
