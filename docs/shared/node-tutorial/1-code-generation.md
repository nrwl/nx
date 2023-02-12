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

![Our Workspace Requirements](/shared/node-tutorial/requirements-diagram.svg)

## Creating an Nx Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}
✔ Choose your style                     · integrated
✔ What to create in the new workspace   · ts
✔ Repository name                       · my-products
✔ Enable distributed caching to make your CI faster · Yes
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

## Install the Node Plugin

Open the folder that was created and install the `@nrwl/node` plugin.

```shell
cd my-products
npm i -D @nrwl/node
```

## Add Two Application to Your Workspace

```{% command="nx g @nrwl/node:app products-api" path="~/my-products" %}
>  NX  Generating @nrwl/node:application

CREATE packages/products-api/src/app/.gitkeep
CREATE packages/products-api/src/assets/.gitkeep
CREATE packages/products-api/src/main.ts
CREATE packages/products-api/tsconfig.app.json
CREATE packages/products-api/tsconfig.json
CREATE packages/products-api/project.json
CREATE packages/products-api/.eslintrc.json
CREATE packages/products-api/jest.config.ts
CREATE packages/products-api/tsconfig.spec.json
```

Run this command to create your `products-cli` app:

```{% command="npx nx g @nrwl/node:app products-cli" path="~/my-products" %}
>  NX  Generating @nrwl/node:application

CREATE packages/products-cli/src/app/.gitkeep
CREATE packages/products-cli/src/assets/.gitkeep
CREATE packages/products-cli/src/main.ts
CREATE packages/products-cli/tsconfig.app.json
CREATE packages/products-cli/tsconfig.json
CREATE packages/products-cli/project.json
CREATE packages/products-cli/.eslintrc.json
CREATE packages/products-cli/jest.config.ts
CREATE packages/products-cli/tsconfig.spec.json
```

![Nx Generator Syntax](/shared/node-tutorial/generator-syntax.svg)

## Generating Libraries

To create the `products-data-client` library, use the `@nrwl/js:lib` generator:

```{% command="npx nx g @nrwl/js:lib products-data-client" path="~/my-products" %}

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
