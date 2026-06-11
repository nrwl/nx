
The @nx/next plugin provides various generators to help you create and configure next projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `application`
Create a Next.js Application for Nx.

### Examples

###### Create app in a nested directory

```shell
nx g app apps/nested/myapp
```

###### Use a custom Express server

```shell
nx g app apps/myapp --custom-server
```

###### Use plain JavaScript (not TypeScript)

```shell
nx g app apps/myapp --js
```

**Usage:**
```bash
nx generate @nx/next:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/next:application <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appDir` | boolean | Enable the App Router for this project. | `true` |
| `--customServer` | boolean | Use a custom Express server for the Next.js application. | `false` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--name` | string | The name of the application. |  |
| `--rootProject` | boolean | Create an application at the root of the workspace. | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--src` | boolean | Generate a `src` directory for the project. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--swc` | boolean | Enable the Rust-based compiler SWC to compile JS/TS files. | `true` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `component`
Create a React Component for Next.

### Examples

###### Create a Component

Generate a component named `MyComponent` at `apps/my-app/src/app/my-component/my-component.tsx`:

```shell
nx g component apps/my-app/src/app/my-component/my-component.tsx
```

###### Create a Component with a Different Symbol Name

Generate a component named `Custom` at `apps/my-app/src/app/my-component/my-component.tsx`:

```shell
nx g component apps/my-app/src/app/my-component/my-component.tsx --name=custom
```

###### Create a Component Omitting the File Extension

Generate a component named `MyComponent` at `apps/my-app/src/app/my-component/my-component.tsx` without specifying the file extension:

```shell
nx g component apps/my-app/src/app/my-component/my-component
```

**Usage:**
```bash
nx generate @nx/next:component [options]
```

**Arguments:**
```bash
nx generate @nx/next:component <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | When true, the component is exported from the project index.ts (if it exists). | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. |  |
| `--name` | string | The component symbol name. Defaults to the last segment of the file path. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipTests` | boolean | When true, does not create `spec.ts` test files for the new component. | `false` |
| `--style` | string | The file extension to be used for style files. | `"css"` |

## `convert-to-inferred`
Convert existing Next.js project(s) using `@nx/next:build` executor to use `@nx/next/plugin`.

**Usage:**
```bash
nx generate @nx/next:convert-to-inferred [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string | The project to convert from using the `@nx/next:build` executor to use `@nx/next/plugin`. If not provided, all projects using the `@nx/next:build` executor will be converted. |  |
| `--skipFormat` | boolean | Whether to format files. | `false` |

## `custom-server`
Add a custom server to existing Next.js application.

### Examples

###### Add a custom server to existing app

```shell
nx g custom-server my-app
```

**Usage:**
```bash
nx generate @nx/next:custom-server [options]
```

**Arguments:**
```bash
nx generate @nx/next:custom-server <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--compiler` | string | The compiler used to build the custom server. | `"tsc"` |

## `cypress-component-configuration`
Add Cypress Componet Testing to an existing NextJS project.

:::caution[Can I use component testing?]
Next component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you want to test components via Storybook with Cypress, then check out the [storybook-configuration generator docs](/nx-api/react/generators/storybook-configuration). However, this functionality is deprecated, and will be removed on Nx version 19.
:::

This generator is designed to get your Next project up and running with Cypress Component Testing.

```shell
nx g @nx/next:cypress-component-configuration --project=my-cool-next-project
```

Running this generator, adds the required files to the specified project with a preconfigured `cypress.config.ts` designed for Nx workspaces.

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
```

Here is an example on how to add custom options to the configuration

```ts title="cypress.config.ts"
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // extra options here
  },
});
```

```shell
nx g @nx/next:cypress-component-project --project=my-cool-next-project
```

### Auto Generating Tests

You can optionally use the `--generate-tests` flag to generate a test file for each component in your project.

```shell
nx g @nx/next:cypress-component-configuration --project=my-cool-next-project --generate-tests
```

### Running Component Tests

A new `component-test` target will be added to the specified project to run your component tests.

```shell
nx g component-test my-cool-next-project
```

Here is an example of the project configuration that is generated.

```json title="project.json"
{
  "targets" {
    "component-test": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "<path-to-project-root>/cypress.config.ts",
        "testingType": "component",
        "skipServe": true
      }
    }
  }
}
```

Nx also supports [Angular component testing](/nx-api/angular/generators/cypress-component-configuration).

**Usage:**
```bash
nx generate @nx/next:cypress-component-configuration [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | The name of the project to add cypress component testing configuration to |  |
| `--generateTests` | boolean | Generate default component tests for existing components in the project | `false` |
| `--skipFormat` | boolean | Skip formatting files | `false` |

## `library`
Create a React Library for an Nx workspace.

### Examples

###### Create a new lib

```shell
nx g lib libs/my-lib
```

###### Create a new lib under a directory

The following will create a library at `libs/shared/my-lib`.

```shell
nx g lib libs/shared/my-lib
```

**Usage:**
```bash
nx generate @nx/next:library [options]
```

**Aliases:** `lib`

**Arguments:**
```bash
nx generate @nx/next:library <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appProject` | string | The application project to add the library route to. |  |
| `--buildable` | boolean | Generate a buildable library that uses rollup to bundle. | `false` |
| `--bundler` | string | The bundler to use. Choosing 'none' means this library is not buildable. | `"none"` |
| `--component` | boolean | Generate a default component. | `true` |
| `--globalCss` | boolean | When true, the stylesheet is generated using global CSS instead of CSS modules (e.g. file is `*.css` rather than `*.module.css`). | `false` |
| `--importPath` | string | The library name used to import it, like `@myorg/my-awesome-lib`. |  |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--name` | string | Library name |  |
| `--publishable` | boolean | Create a publishable library. |  |
| `--routing` | boolean | Generate library with routes. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipTsConfig` | boolean | Do not update tsconfig.json for development experience. | `false` |
| `--strict` | boolean | Whether to enable tsconfig strict mode or not. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `page`
Create a Page for Next.

### Examples

###### Create a Static Page

Generate a static page named `MyPage` at `apps/my-app/pages/my-page/page.tsx`:

```shell
nx g page apps/my-app/pages/my-page
```

###### Create a Dynamic Page

Generate a dynamic page at `apps/my-app/pages/products/[id]/page.tsx`:

```shell
nx g page "apps/my-app/pages/products/[id]"
```

**Usage:**
```bash
nx generate @nx/next:page [options]
```

**Arguments:**
```bash
nx generate @nx/next:page <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | When true, the component is exported from the project `index.ts` (if it exists). | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--name` | string | The page symbol name. Defaults to the page directory name. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--withTests` | boolean | When true, creates a `spec.ts` test file for the new page. | `false` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/next:<generator> --help
```
