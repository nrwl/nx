{% callout type="check" title="Integrated Repo" %}
This tutorial sets up an [integrated](/concepts/integrated-vs-package-based) repo. If you prefer a [package-based repo](/concepts/integrated-vs-package-based), check out the [Core Tutorial](/getting-started/core-tutorial).
{% /callout %}

# React Nx Tutorial - Part 1: Code Generation

In this tutorial you'll create a frontend-focused workspace with Nx.

## Contents

- [1 - Code Generation](/react-tutorial/1-code-generation)
- [2 - Nx Graph](/react-tutorial/2-nx-graph)
- [3 - Task Running](/react-tutorial/3-task-running)
- [4 - Workspace Optimization](/react-tutorial/4-workspace-optimization)
- [5 - Summary](/react-tutorial/5-summary)

## Your Objective

For this tutorial, your objective is to create the initial architecture for a workspace with the following requirements:

- it should contain two React applications: `store` and `admin`.
- it should have a collection of common React components in a project called: `common-ui`
- it should have a "not-React" library for business logic called: `products`
- your `store` app should depend on `common-ui` and `products`
- your `admin` app should only depend on `common-ui`

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.png)

## Creating an Nx Workspace

To generate your Nx Workspace, use the [`create-nx-workspace` script from npm](https://www.npmjs.com/package/create-nx-workspace):

```bash
npx create-nx-workspace@latest
```

When prompted, provide the following responses:

```bash
Workspace name (e.g., org name)     myorg
What to create in the new workspace react
Application name                    store
Default stylesheet format           CSS
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

We can see that two projects were added to the workspace:

- A React application located in `apps/store`.
- A Project for Cypress e2e tests for our `store` application in `apps/store-e2e`.

{% card title="Nx Cypress Support" description="While we see the Cypress project here, we won't go deeper on Cypress in this tutorial. You can find more materials on Nx Cypress support on the @nrwl/cypress package page." url="/packages/cypress" /%}

## Adding Another Application to Your Workspace

Initializing your workspace created your `store` application. Next you'll use [Nx generators](/plugin-features/use-code-generators) to generate the required `admin` application.

The following syntax is used to run generators:

![Nx Generator Syntax](/shared/react-tutorial/generator-syntax.png)

You should use the `application` generator found in the `@nrwl/react` plugin. To run the generator and create the `admin` application, run the command `npx nx g @nrwl/react:app admin`:

```bash
% npx nx g @nrwl/react:app admin

>  NX  Generating @nrwl/react:application

CREATE apps/admin/.babelrc
CREATE apps/admin/.browserslistrc
CREATE apps/admin/src/app/app.spec.tsx
CREATE apps/admin/src/app/nx-welcome.tsx
CREATE apps/admin/src/assets/.gitkeep
CREATE apps/admin/src/environments/environment.prod.ts
CREATE apps/admin/src/environments/environment.ts
CREATE apps/admin/src/favicon.ico
CREATE apps/admin/src/index.html
CREATE apps/admin/src/main.tsx
CREATE apps/admin/src/polyfills.ts
CREATE apps/admin/tsconfig.app.json
CREATE apps/admin/tsconfig.json
CREATE apps/admin/src/app/app.module.css
CREATE apps/admin/src/app/app.tsx
CREATE apps/admin/src/styles.css
CREATE apps/admin/project.json
CREATE apps/admin/.eslintrc.json
CREATE apps/admin-e2e/cypress.config.ts
CREATE apps/admin-e2e/src/e2e/app.cy.ts
CREATE apps/admin-e2e/src/fixtures/example.json
CREATE apps/admin-e2e/src/support/app.po.ts
CREATE apps/admin-e2e/src/support/commands.ts
CREATE apps/admin-e2e/src/support/e2e.ts
CREATE apps/admin-e2e/tsconfig.json
CREATE apps/admin-e2e/project.json
CREATE apps/admin-e2e/.eslintrc.json
CREATE apps/admin/jest.config.ts
CREATE apps/admin/tsconfig.spec.json
```

To see all options for the `application` generator, you can run the command `npx nx generate @nrwl/react:application --help`:

```bash
% npx nx generate @nrwl/react:application --help

>  NX   generate @nrwl/react:application [name] [options,...]

From: @nrwl/react (v14.8.3)
Name: application (aliases: app)

Create a React application for Nx.

Options:
--name The name of the application. [string]
--directory, -dir The directory of the new application. [string]
.....

Examples:
nx g app myapp --directory=myorg Generate `apps/myorg/myapp` and `apps/myorg/myapp-e2e`
nx g app myapp --classComponent Use class components instead of functional components
nx g app myapp --routing Set up React Router

Find more information and examples at: https://nx.dev/packages/react/generators/application

```

## Generating Libraries

To create the `common-ui` and `products` libraries, use the `@nrwl/react:lib` and `@nrwl/js:lib` generators respectively:

{% side-by-side %}

```bash
% npx nx g @nrwl/react:lib common-ui

> NX Generating @nrwl/react:library

CREATE libs/common-ui/project.json
CREATE libs/common-ui/.eslintrc.json
CREATE libs/common-ui/.babelrc
CREATE libs/common-ui/README.md
CREATE libs/common-ui/src/index.ts
CREATE libs/common-ui/tsconfig.json
CREATE libs/common-ui/tsconfig.lib.json
UPDATE tsconfig.base.json
CREATE libs/common-ui/jest.config.ts
CREATE libs/common-ui/tsconfig.spec.json
CREATE libs/common-ui/src/lib/common-ui.module.css
CREATE libs/common-ui/src/lib/common-ui.spec.tsx
CREATE libs/common-ui/src/lib/common-ui.tsx
```

```bash
% npx nx g @nrwl/js:lib products

>  NX  Generating @nrwl/js:library

CREATE libs/products/README.md
CREATE libs/products/package.json
CREATE libs/products/src/index.ts
CREATE libs/products/src/lib/products.spec.ts
CREATE libs/products/src/lib/products.ts
CREATE libs/products/tsconfig.json
CREATE libs/products/tsconfig.lib.json
CREATE libs/products/.babelrc
CREATE libs/products/project.json
UPDATE tsconfig.base.json
CREATE libs/products/.eslintrc.json
CREATE libs/products/jest.config.ts
CREATE libs/products/tsconfig.spec.json
```

{% /side-by-side %}

We should now be able to see all four required projects:

- `store` in `apps/store`
- `admin` in `apps/admin`
- `products` in `libs/products`
- `common-ui` in `libs/common-ui`

## What's Next

- Continue to [2: Nx Graph](/react-tutorial/2-nx-graph)
