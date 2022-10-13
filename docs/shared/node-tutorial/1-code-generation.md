---
title: 'Node Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a backend-focused workspace with Nx.
---

{% callout type="check" title="Two Styles of Repo" %}
There are two styles of repos: integrated and package-based. This tutorial shows the integrated style.

You can find more information on the difference between the two in [our introduction](/getting-started/intro).
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

For this tutorial, you'll create an Express API application, a CLI (command-line interface) application, and a library for a data client that these two applications will use to interact with a data-source.

![Our Workspace Requirements](/shared/node-tutorial/requirements-diagram.png)

## Creating an Nx Workspace

Run the command:

```shell
npx create-nx-workspace@latest
```

When prompted, provide the following responses:

```shell
✔ Workspace name (e.g., org name)     · my-products
✔ What to create in the new workspace · express
✔ Application name                    · products-api
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

Once the command complete, you can find your Express API application in `apps/products-api`.

## Adding Another Application to Your Workspace

Run this command to create your `products-cli` app:

```shell
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

![Nx Generator Syntax](/shared/node-tutorial/generator-syntax.png)

## Generating Libraries

To create the `products-data-client` library, use the `@nrwl/js:lib` generator:

```shell
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

You have now created all three projects from the design:

- `products-api` in `apps/products-api`
- `products-cli` in `apps/products-cli`
- `products-data-client` in `libs/products-data-client`

## What's Next

- Continue to [2: Project Graph](/node-tutorial/2-project-graph)
