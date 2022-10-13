---
title: 'Node Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a backend-focused workspace with Nx.
---

{% callout type="check" title="Integrated Repo" %}
This tutorial sets up an [integrated](/concepts/integrated-vs-package-based) repo. If you prefer a [package-based repo](/concepts/integrated-vs-package-based), check out the [Core Tutorial](/getting-started/core-tutorial).
{% /callout %}

# Node Tutorial - Part 1: Code Generation

In this tutorial you'll create a backend-focused workspace with Nx.

## Contents

- [1 - Code Generation](/node-tutorial/1-code-generation)
- [2 - Project Graph](/node-tutorial/2-project-graph)
- [3 - Task Running](/node-tutorial/3-task-running)
- [4 - Workspace Optimization](/node-tutorial/4-workspace-optimization)
- [5 - Summary](/node-tutorial/5-summary)

## Your Objective

For this tutorial, your objective is to create the initial architecture for a workspace with the following requirements:

- it should contain an api built with express called: `products-api`.
- it should contain a node cli application called: `products-cli`.
- it should contain a library for interacting with a data-source called: `products-data-client`.
- your `products-api` app should depend on the `products-data-client` library.
- your `products-cli` app should also depend on the `products-data-client` library.

![Our Workspace Requirements](/shared/node-tutorial/requirements-diagram.png)

## Creating an Nx Workspace

To generate your Nx Workspace, use the [`create-nx-workspace` script from npm](https://www.npmjs.com/package/create-nx-workspace):

```bash
npx create-nx-workspace@latest
```

When prompted, provide the following responses:

```bash
✔ Workspace name (e.g., org name)     · my-products
✔ What to create in the new workspace · express
✔ Application name                    · products-api
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

Once the script is complete, you can open up the `my-products` directory that was created, and see that your first project has been added to the workspace, located in `apps/products-api`.

## Adding Another Application to Your Workspace

Next you'll use [Nx generators](/plugin-features/use-code-generators) to generate the required `products-cli` application.

The following syntax is used to run generators:

![Nx Generator Syntax](/shared/node-tutorial/generator-syntax.png)

To run the node application generator and create your `products-cli` application, run the command `npx nx g @nrwl/node:app products-cli`:

```bash
% npx nx g @nrwl/node:app products-cli

>  NX  Generating @nrwl/node:application

CREATE apps/products-cli/src/app/.gitkeep
CREATE apps/products-cli/src/assets/.gitkeep
CREATE apps/products-cli/src/environments/environment.prod.ts
CREATE apps/products-cli/src/environments/environment.ts
CREATE apps/products-cli/src/main.ts
CREATE apps/products-cli/tsconfig.app.json
CREATE apps/products-cli/tsconfig.json
CREATE apps/products-cli/project.json
CREATE apps/products-cli/.eslintrc.json
CREATE apps/products-cli/jest.config.ts
CREATE apps/products-cli/tsconfig.spec.json
```

To see all options for the `application` generator, you can run the command `npx nx generate @nrwl/node:application --help`:

```bash
% npx nx generate @nrwl/node:application --help

>  NX   generate @nrwl/node:application [name] [options,...]


From:  @nrwl/node (v14.8.4)
Name:  application (aliases: app)


  Nx Application Options Schema.


Options:
    --name             The name of the application.                  [string]
    --directory        The directory of the new application.         [string]
    --skipFormat       Skip formatting files                        [boolean]
    --skipPackageJson  Do not add dependencies to `package.json`.   [boolean]
    ...
```

## Generating Libraries

To create the `products-data-client` library, use the `@nrwl/js:lib` generator:

```bash
% npx nx g @nrwl/js:lib products-data-client

>  NX  Generating @nrwl/js:library

CREATE libs/products-data-client/README.md
CREATE libs/products-data-client/package.json
CREATE libs/products-data-client/src/index.ts
CREATE libs/products-data-client/src/lib/products-data-client.spec.ts
CREATE libs/products-data-client/src/lib/products-data-client.ts
CREATE libs/products-data-client/tsconfig.json
CREATE libs/products-data-client/tsconfig.lib.json
CREATE libs/products-data-client/project.json
UPDATE tsconfig.base.json
CREATE libs/products-data-client/.eslintrc.json
CREATE libs/products-data-client/jest.config.ts
CREATE libs/products-data-client/tsconfig.spec.json
```

You have now created all three required projects:

- `products-api` in `apps/products-api`
- `products-cli` in `apps/products-cli`
- `products-data-client` in `libs/products-data-client`

## What's Next

- Continue to [2: Project Graph](/node-tutorial/2-project-graph)
