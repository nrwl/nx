{% callout type="check" title="Integrated Repo" %}
This tutorial sets up an [integrated](/concepts/integrated-vs-package-based) repo. If you prefer a [package-based repo](/concepts/integrated-vs-package-based), check out the [Core Tutorial](/getting-started/core-tutorial).
{% /callout %}

{% callout type="note" title="Nx has first-class Next.js support" %}
Nx has first-class Next.js support, if you are looking to use it for your project. Read more about it [here](/packages/next)
{% /callout %}

# React Nx Tutorial - Part 1: Code Generation

In this tutorial you'll create a frontend-focused workspace with Nx.

## Contents

- 1 - Code Generation (You are here!)
- [2 - Nx Graph](/react-tutorial/2-nx-graph)
- [3 - Task Running](/react-tutorial/3-task-running)
- [4 - Workspace Optimization](/react-tutorial/4-workspace-optimization)
- [5 - Summary](/react-tutorial/5-summary)

## Your Objective

For this tutorial, your objective is to create the initial architecture for a workspace that will house two React applications: `store` and `admin`.

Your organization prioritizes consistent UI, so you'll also need to create a collection of common React components called: `common-ui`. Finally there's some domain logic that you are required to break out into a `product` Typescript library that your `store` app will need, but your `admin` app won't (at least for this tutorial).

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.png)

## Creating an Nx Workspace

One of the major benefits of using Nx is repository scaffolding with a first-class code generation API, and the first place you'll see this code generation in action is by generating your first Nx Workspace.

To do this, use the [`create-nx-workspace` script from npm](https://www.npmjs.com/package/create-nx-workspace) to generate your workspace:

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

{% callout type="note" title="Opting into Nx Cloud" %}
The `create-nx-workspace` script will also prompt you whether you want to add [Nx Cloud](https://nx.app) to your workspace.

We won't address this in this tutorial, but you can see the [introduction to Nx Cloud](/nx-cloud/intro/what-is-nx-cloud) for more details.
{% /callout %}

We can see that two projects were added to the workspace:

- A React application located in `apps/store`.
- A Project for Cypress e2e tests for our `store` application in `apps/store-e2e`.

{% callout type="note" title="Nx Cypress Support" %}
While we see the Cypress project here, we won't go deeper on Cypress in this tutorial.

You can find more materials on Nx Cypress support on [the @nrwl/cypress package page](/packages/cypress).
{% /callout %}

## Adding Another Application to Your Workspace

Using the `create-nx-workspace` script is a special case that will get you started. To generate the other required `admin` application to this workspace, you'll want to use [Nx generators](/plugin-features/use-code-generators).

Nx follows a plugin-based architecture - so by installing an Nx plugin, we gain access to the generators provided by the plugin.

When you ran the `create-nx-workspace`, you added the required plugins for a React project, and so you've already installed several plugins. You can see the full list of installed plugins by running `npx nx list`:

```bash
> npx nx list

 >  NX   Local workspace plugins:

 > NX Installed plugins:

@nrwl/cypress (executors,generators)
@nrwl/jest (executors,generators)
@nrwl/js (executors,generators)
@nrwl/linter (executors,generators)
@nrwl/nx-cloud (generators)
@nrwl/react (executors,generators)
@nrwl/rollup (executors,generators)
@nrwl/storybook (executors,generators)
@nrwl/web (executors,generators)
@nrwl/webpack (executors,generators)
@nrwl/workspace (executors,generators)
nx (executors)

> NX Also available:

@nrwl/angular (executors,generators)
@nrwl/detox (executors,generators)
@nrwl/esbuild (executors,generators)
@nrwl/expo (executors,generators)
@nrwl/express (generators)
@nrwl/nest (generators)
@nrwl/next (executors,generators)
@nrwl/node (executors,generators)
@nrwl/nx-plugin (executors,generators)
@nrwl/react-native (executors,generators)

> NX Community plugins:

nx-plugins - Nx plugin integrations with ESBuild / Vite / Snowpack / Prisma, with derived ESBuild / nowpack / ... plugins.
@codebrew/nx-aws-cdk - An Nx plugin for aws cdk develop.
...
```

To list the generators of the `@nrwl/react` package, you can run the command `npx nx list @nrwl/react`:

```bash
> npx nx list @nrwl/react

 >  NX   Capabilities in @nrwl/react:

   GENERATORS

   init : Initialize the `@nrwl/react` plugin.
   application : Create a React application.
   library : Create a React library.
   component : Create a React component.
   redux : Create a Redux slice for a project.
   storybook-configuration : Set up storybook for a React app or library.
   component-story : Generate storybook story for a React component.
   stories : Create stories/specs for all components declared in an app or library.
   component-cypress-spec : Create a Cypress spec for a UI component that has a story.
   hook : Create a hook.
   cypress-component-configuration : Setup Cypress component testing for a React project.
   component-test : Generate a Cypress component test for a React component.
   setup-tailwind : Set up Tailwind configuration for a project.

   EXECUTORS/BUILDERS

   module-federation-dev-server : Serve a host or remote application.
```

{% callout type="note" title="Nx Console" %}
The [Nx Console VsCode Plugin]() can also be used to give you a full filterable list of all generators you have currently installed.
{% /callout %}

Since we want to add another React application to our workspace, the `application` generator above looks most helpful.

{% callout type="note" title="Discovering Generator Options" %}
To see all options for the `application` generator, you can run the command: `npx nx generate @nrwl/react:application --help`:

```bash
> npx nx generate @nrwl/react:application --help
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

Additionally, the [Nx Console VsCode Plugin]() provides a form for all generators that creates good discoverability for generator options as well.
{% /callout %}

The following syntax is used to run generators:

![Nx Generator Syntax](/shared/react-tutorials/generator-syntax.png)

To run the generator and create our `admin` application, we can run the command:

```bash
> npx nx g @nrwl/react:app admin

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

{% callout type="note" title="Dry Run" %}
Adding the option `--dry-run` to your `nx generate` command will allow you to preview in the terminal what the results of the generator would be, without actually running the generator.
{% /callout %}

## Generating Libraries

To create our `common-ui` and `product` libraries, we'll use the `@nrwl/react:lib` and `@nrwl/js:lib` generators respectively:

{% side-by-side %}

```bash
> npx nx g @nrwl/react:lib common-ui

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
`npx nx g @nrwl/js:lib products`
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

{% callout type="note" title="Using JS Source Code Instead of TS" %}
By default, our generators create `.ts` files for your source code. To opt into `.js` files instead, the `--js` option can be added for most applicable generators. See the [`@nrwl/js:lib` generator](/packages/js/generators/library#js) for example.
{% /callout %}

{% callout type="note" title="Differences Between Apps and Libs" %}
Note that we used `application` generators for our two apps, while we used `library` generators for our `products` and `common-ui` projects.

Both `application`s and `library`s are "projects" from the perspective of Nx.

Generally, `applications` are projects that are expected to be at the "top" of the dependency tree (no other projects should consume them) and are intended to be deployed to a web server once built.

While `library`s are generally intended to be consumed by `applications` and other `library`s.

Functionally the difference will be in the `targets` defined for each (see our later lesson: [3 - Tasks](/react-tutorial/3-task-running)), and by default, `applications` will go in the `apps` directory while `library`s will go in the `libs` directory.
{% /callout %}

We should now be able to see all four required projects:

- `store` in `apps/store`
- `admin` in `apps/admin`
- `products` in `libs/products`
- `common-ui` in `libs/common-ui`

## What's Next

- Continue to [2: Project Graph](/react-tutorial/2-nx-graph)

{% callout type="note" title="Advanced Code Generation With Nx" %}
The Nx Plugin API allows for ways to create your own generators that extend the code generators that we used in this lesson. This can be a great tool for promoting consistent architecture in your workspace and organization.
To learn more, checkout our [`@nrwl/nx-plugins` package documentation](/packages/nx-plugin#generator).
{% /callout %}
