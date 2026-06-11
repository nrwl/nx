
The @nx/react plugin provides various generators to help you create and configure react projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `application`
Create a React application for Nx.

### Examples

###### Simple Application

Create an application named `my-app`:

```bash
nx g @nx/react:application apps/my-app
```

###### Application using Vite as bundler

Create an application named `my-app`:

```bash
nx g @nx/react:app apps/my-app --bundler=vite
```

When choosing `vite` as the bundler, your unit tests will be set up with `vitest`, unless you choose `none` for `unitTestRunner`.

###### Specify style extension

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```bash
nx g @nx/react:app apps/my-dir/my-app --style=scss
```

###### Add tags

Add tags to the application (used for linting).

```bash
nx g @nx/react:app apps/my-app --tags=scope:admin,type:ui
```

**Usage:**
```bash
nx generate @nx/react:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/react:application <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--bundler` | string | The bundler to use. | `"vite"` |
| `--classComponent` | boolean | Use class components instead of functional component. | `false` |
| `--compiler` | string | The compiler to use. | `"babel"` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--globalCss` | boolean | Default is `false`. When `true`, the component is generated with `*.css`/`*.scss` instead of `*.module.css`/`*.module.scss`. | `false` |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--minimal` | boolean | Generate a React app with a minimal setup, no separate test files. | `false` |
| `--name` | string | The name of the application. |  |
| `--port` | number | The port to use for the development server | `4200` |
| `--rootProject` | boolean | Create a application at the root of the workspace | `false` |
| `--routing` | boolean | Generate application with routes. | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipNxJson` | boolean | Skip updating `nx.json` with default options based on values provided to this app. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--strict` | boolean | Creates an application with strict mode and strict type checking. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |
| `--useReactRouter` | boolean | Use React Router for routing. | `false` |

## `component`
Create a React Component for Nx.

### Examples

###### Simple Component

Create a component named `MyComponent` at `libs/ui/src/my-component.tsx`:

```shell
nx g @nx/react:component libs/ui/src/my-component.tsx
```

###### With a Different Symbol Name

Create a component named `Custom` at `libs/ui/src/my-component.tsx`:

```shell
nx g @nx/react:component libs/ui/src/my-component.tsx --name=custom
```

###### Omitting the File Extension

Create a component named `MyComponent` at `libs/ui/src/my-component.tsx` without specifying the file extension:

```shell
nx g @nx/react:component libs/ui/src/my-component
```

###### Class Component

Create a class component named `MyComponent` at `libs/ui/src/my-component.tsx`:

```shell
nx g @nx/react:component libs/ui/src/my-component --classComponent
```

**Usage:**
```bash
nx generate @nx/react:component [options]
```

**Aliases:** `c`

**Arguments:**
```bash
nx generate @nx/react:component <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--classComponent` | boolean | Use class components instead of functional component. | `false` |
| `--export` | boolean | When true, the component is exported from the project `index.ts` (if it exists). | `false` |
| `--globalCss` | boolean | Default is `false`. When `true`, the component is generated with `*.css`/`*.scss` instead of `*.module.css`/`*.module.scss`. | `false` |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. |  |
| `--name` | string | The component symbol name. Defaults to the last segment of the file path. |  |
| `--routing` | boolean | Generate a library with routes. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipTests` | boolean | When true, does not create `spec.ts` test files for the new component. | `false` |
| `--style` | string | The file extension to be used for style files. | `"css"` |

## `component-story`
Generate storybook story for a react component.

**Usage:**
```bash
nx generate @nx/react:component-story [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--componentPath` | string [**required**] | Relative path to the component file from the library root. |  |
| `--project` | string [**required**] | The project where to add the components. |  |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `component-test`
Add a Cypress component test for a component.

### Examples

:::caution[Can I use component testing?]
React component testing with Nx requires **Cypress version 10** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you're wanting to create Storybook stories for a component, then check out the [stories generator docs](/nx-api/react/generators/stories)
:::

This generator is used to create a Cypress component test file for a given React component.

```shell
nx g @nx/react:component-test --project=my-cool-react-project --componentPath=src/my-fancy-button.tsx
```

Test file are generated with the `.cy.` suffix. this is to prevent colliding with any existing `.spec.` files contained in the project.

It's currently expected the generated `.cy.` file will live side by side with the component. It is also assumed the project is already setup for component testing. If it isn't, then you can run the [cypress-component-project generator](/nx-api/react/generators/cypress-component-configuration) to set up the project for component testing.

**Usage:**
```bash
nx generate @nx/react:component-test [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--componentPath` | string [**required**] | Path to component, from the project source root |  |
| `--project` | string [**required**] | The name of the project the component is apart of |  |

## `cypress-component-configuration`
Add a Cypress component testing configuration to an existing project.

:::caution[Can I use component testing?]
React component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you want to test components via Storybook with Cypress, then check out the [storybook-configuration generator docs](/nx-api/react/generators/storybook-configuration). However, this functionality is deprecated, and will be removed on Nx version 19.
:::

This generator is designed to get your React project up and running with Cypress Component Testing.

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project
```

Running this generator, adds the required files to the specified project with a preconfigured `cypress.config.ts` designed for Nx workspaces.

The following file will be added to projects where the Component Testing build target is using `webpack` for bundling:

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, {
    bundler: 'webpack',
  }),
});
```

The following file will be added to projects where the Component Testing build target is using `vite` for bundling:

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, {
    bundler: 'vite',
  }),
});
```

Here is an example on how to add custom options to the configuration

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename, {
      bundler: 'webpack',
    }),
    // extra options here
  },
});
```

### The `bundler` option

Component testing supports two different bundlers: `webpack` and `vite`. The Nx generator will pick up the bundler used in the specified project's build target. If the build target is using `@nx/webpack:webpack`, then the generator will use `webpack` as the bundler. If the build target is using `@nx/vite:build`, then the generator will use `vite` as the bundler.

You can manually set the bundler by passing `--bundler=webpack` or `--bundler=vite` to the generator, but that is not needed since the generator will pick up the correct bundler for you. However, if you want to use a different bundler than the one that is used in the build target, then you can manually set it using that flag.

### Specifying a Build Target

Component testing requires a _build target_ to correctly run the component test dev server. This option can be manually specified with `--build-target=some-react-app:build`, but Nx will infer this usage from the [project graph](/concepts/mental-model#the-project-graph) if one isn't provided.

For React projects, the build target needs to be using the `@nx/webpack:webpack` executor.
The generator will throw an error if a build target can't be found and suggest passing one in manually.

Letting Nx infer the build target by default

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project
```

Manually specifying the build target

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project --build-target:some-react-app:build --generate-tests
```

:::note[Build Target with Configuration]
If you're wanting to use a build target with a specific configuration. i.e. `my-app:build:production`,
then manually providing `--build-target=my-app:build:production` is the best way to do that.
:::

### Auto Generating Tests

You can optionally use the `--generate-tests` flag to generate a test file for each component in your project.

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project --generate-tests
```

### Running Component Tests

A new `component-test` target will be added to the specified project to run your component tests.

```shell
nx g component-test my-cool-react-project
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
        "devServerTarget": "some-react-app:build",
        "skipServe": true
      }
    }
  }
}
```

Nx also supports [Angular component testing](/nx-api/angular/generators/cypress-component-configuration).

**Usage:**
```bash
nx generate @nx/react:cypress-component-configuration [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project to add cypress component testing configuration to |  |
| `--buildTarget` | string | A build target used to configure Cypress component testing in the format of `project:target[:configuration]`. The build target should be from a React app. If not provided we will try to infer it from your projects usage. |  |
| `--bundler` | string | The bundler to use for Cypress Component Testing. |  |
| `--generateTests` | boolean | Generate default component tests for existing components in the project | `false` |
| `--skipFormat` | boolean | Skip formatting files | `false` |

## `federate-module`
Create a federated module, which can be loaded by a Consumer (host) via a Producer (remote).

**Usage:**
```bash
nx generate @nx/react:federate-module [options]
```

**Arguments:**
```bash
nx generate @nx/react:federate-module <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--name` | string [**required**] | The name of the module. |  |
| `--remote` | string [**required**] | The name of the Producer (remote). |  |
| `--bundler` | string | The bundler to use. | `"rspack"` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"cypress"` |
| `--host` | string | The Consumer (host) application for this Producer (remote). |  |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--remoteDirectory` | string | The directory of the new Producer (remote) application if one needs to be created. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--style` | string | The file extension to be used for style files. | `"none"` |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"jest"` |

## `hook`
Create a React component using Hooks in a dedicated React project.

**Usage:**
```bash
nx generate @nx/react:hook [options]
```

**Aliases:** `c`

**Arguments:**
```bash
nx generate @nx/react:hook <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | When true, the hook is exported from the project `index.ts` (if it exists). | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. |  |
| `--name` | string | The hook symbol name. Defaults to the last segment of the file path. |  |
| `--skipTests` | boolean | When true, does not create `spec.ts` test files for the new hook. | `false` |

## `host`
Create Module Federation configuration files for given React Consumer (Host) Application.

**Usage:**
```bash
nx generate @nx/react:host [options]
```

**Aliases:** `consumer`

**Arguments:**
```bash
nx generate @nx/react:host <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--bundler` | string | The bundler to use. | `"rspack"` |
| `--classComponent` | boolean | Use class components instead of functional component. | `false` |
| `--compiler` | string | The compiler to use | `"babel"` |
| `--devServerPort` | number | The port for the dev server of the Producer (remote) app. | `4200` |
| `--dynamic` | boolean | Should the Consumer (host) application use dynamic federation? | `false` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--globalCss` | boolean | Default is false. When true, the component is generated with *.css/*.scss instead of *.module.css/*.module.scss | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--minimal` | boolean | Generate a React app with a minimal setup. No nx starter template. | `false` |
| `--name` | string | The name of the Consumer (host) application to generate the Module Federation configuration |  |
| `--remotes` | array | A list of Producer (remote) application names that the Consumer (host) application should consume. | `[]` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipNxJson` | boolean | Skip updating nx.json with default options based on values provided to this app (e.g. babel, style). | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--ssr` | boolean | Whether to configure SSR for the Consumer (host) application | `false` |
| `--strict` | boolean | Creates an application with strict mode and strict type checking | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. When --js is used, this flag is ignored. | `true` |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"jest"` |

## `library`
Create a React Library for an Nx workspace.

**Usage:**
```bash
nx generate @nx/react:library [options]
```

**Aliases:** `lib`

**Arguments:**
```bash
nx generate @nx/react:library <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appProject` | string | The application project to add the library route to. |  |
| `--buildable` | boolean | Generate a buildable library that uses rollup to bundle. | `false` |
| `--bundler` | string | The bundler to use. Choosing 'none' means this library is not buildable. | `"none"` |
| `--compiler` | string | Which compiler to use. | `"babel"` |
| `--component` | boolean | Generate a default component. | `true` |
| `--globalCss` | boolean | When `true`, the stylesheet is generated using global CSS instead of CSS modules (e.g. file is `*.css` rather than `*.module.css`). | `false` |
| `--importPath` | string | The library name used to import it, like `@myorg/my-awesome-lib`. |  |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--minimal` | boolean | Create a React library with a minimal setup, no separate test files. | `false` |
| `--name` | string | Library name |  |
| `--publishable` | boolean | Create a publishable library. |  |
| `--routing` | boolean | Generate library with routes. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipTsConfig` | boolean | Do not update `tsconfig.json` for development experience. | `false` |
| `--strict` | boolean | Whether to enable tsconfig strict mode or not. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `redux`
Create a Redux state slice for a React project.

**Usage:**
```bash
nx generate @nx/react:redux [options]
```

**Aliases:** `slice`

**Arguments:**
```bash
nx generate @nx/react:redux <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appProject` | string | The application project to add the slice to. |  |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. |  |
| `--name` | string | The Redux state slice symbol name. Defaults to the last segment of the file path. |  |

## `remote`
Create Module Federation configuration files for given React Producer (Remote) Application.

**Usage:**
```bash
nx generate @nx/react:remote [options]
```

**Aliases:** `producer`

**Arguments:**
```bash
nx generate @nx/react:remote <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--bundler` | string | The bundler to use. | `"rspack"` |
| `--classComponent` | boolean | Use class components instead of functional component. | `false` |
| `--compiler` | string | The compiler to use. | `"babel"` |
| `--devServerPort` | number | The port for the dev server of the Producer (remote) app. |  |
| `--dynamic` | boolean | Should the Consumer (host) application use dynamic federation? | `false` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--globalCss` | boolean | Default is false. When true, the component is generated with *.css/*.scss instead of *.module.css/*.module.scss. | `false` |
| `--host` | string | The Consumer (host) application for this Producer (remote). |  |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--name` | string | The name of the Producer (remote) application to generate the Module Federation configuration |  |
| `--routing` | boolean | Generate application with routes. | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint "parserOptions.project" option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipNxJson` | boolean | Skip updating nx.json with default options based on values provided to this app (e.g. babel, style). | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--ssr` | boolean | Whether to configure SSR for the Consumer (host) application | `false` |
| `--strict` | boolean | Creates an application with strict mode and strict type checking. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--typescriptConfiguration` | boolean | Whether the module federation configuration and webpack configuration files should use TS. When --js is used, this flag is ignored. | `true` |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"jest"` |

## `setup-ssr`
Create the additional configuration required to enable SSR via Express for a React application.

**Usage:**
```bash
nx generate @nx/react:setup-ssr [options]
```

**Arguments:**
```bash
nx generate @nx/react:setup-ssr <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appComponentImportPath` | string | The import path of the <App/ > component, relative to project sourceRoot. | `"app/app"` |
| `--bundler` | string | The bundler to use. | `"webpack"` |
| `--extraInclude` | array | Extra include entries in tsconfig. | `[]` |
| `--serverPort` | number | The port for the Express server. | `4200` |
| `--skipFormat` | boolean | Skip formatting the workspace after the generator completes. |  |

## `setup-tailwind`
Adds the Tailwind CSS configuration files for a given React project and installs, if needed, the packages required for Tailwind CSS to work.

**Usage:**
```bash
nx generate @nx/react:setup-tailwind [options]
```

**Arguments:**
```bash
nx generate @nx/react:setup-tailwind <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--buildTarget` | string | The name of the target used to build the project. This option is not needed in most cases. | `"build"` |
| `--skipFormat` | boolean | Skips formatting the workspace after the generator completes. |  |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |

## `stories`
Generate stories/specs for all components declared in a project.

This generator will generate stories for all your components in your project. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```bash
nx g @nx/react:stories project-name
```

You can read more about how this generator works, in the [Storybook for React overview page](/recipes/storybook/overview-react#auto-generate-stories).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests)..

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

### Examples

#### Ignore certain paths when generating stories

```bash
nx g @nx/react:stories --name=ui --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*
```

This will generate stories for all the components in the `ui` project, except for the ones in the `libs/ui/src/not-stories` directory, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

#### Generate stories using JavaScript instead of TypeScript

```bash
nx g @nx/react:stories --name=ui --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.

**Usage:**
```bash
nx generate @nx/react:stories [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | Project for which to generate stories. |  |
| `--ignorePaths` | array | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `storybook-configuration`
Set up Storybook for a React app or library.

This generator will set up Storybook for your **React** project. You can also use this generator to generate Storybook configuration for your **Next.js** project. By default, Storybook v10 is used.

```bash
nx g @nx/react:storybook-configuration project-name
```

You can read more about how this generator works, in the [Storybook for React overview page](/recipes/storybook/overview-react#generate-storybook-configuration-for-an-react-project).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/react/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. Also, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/react/writing-tests/test-runner). You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests)..
- Whether you want to `generateStories` for the components in your project. If you choose `yes`, a `.stories.ts` file will be generated next to each of your components in your project.

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/react/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

### Examples

#### Generate Storybook configuration

```bash
nx g @nx/react:storybook-configuration ui
```

This will generate Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory, eg. `.storybook/main.ts`).

#### Ignore certain paths when generating stories

```bash
nx g @nx/react:storybook-configuration ui --generateStories=true --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*,apps/my-app/**/*.something.ts
```

This will generate a Storybook configuration for the `ui` project and generate stories for all components in the `libs/ui/src/lib` directory, except for the ones in the `libs/ui/src/not-stories` directory, and the ones in the `apps/my-app` directory that end with `.something.ts`, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

#### Generate stories using JavaScript instead of TypeScript

```bash
nx g @nx/react:storybook-configuration ui --generateStories=true --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.

#### Generate Storybook configuration using JavaScript

```bash
nx g @nx/react:storybook-configuration ui --tsConfiguration=false
```

By default, our generator generates TypeScript Storybook configuration files. You can choose to use JavaScript for the Storybook configuration files of your project (the files inside the `.storybook` directory, eg. `.storybook/main.js`).

**Usage:**
```bash
nx generate @nx/react:storybook-configuration [options]
```

**Arguments:**
```bash
nx generate @nx/react:storybook-configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--configureStaticServe` | boolean | Specifies whether to configure a static file server target for serving storybook. Helpful for speeding up CI build/test times. | `true` |
| `--generateStories` | boolean | Automatically generate `*.stories.ts` files for components declared in this project? | `true` |
| `--ignorePaths` | array | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--js` | boolean | Generate JavaScript story files rather than TypeScript story files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--tsConfiguration` | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js. | `true` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/react:<generator> --help
```
