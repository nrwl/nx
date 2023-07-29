---
title: 'React Monorepo Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

{% callout type="check" title="Two Styles of Repo" %}
There are two styles of repos: integrated and package-based. This tutorial shows the integrated style.

You can find more information on the difference between the two in [our introduction](/getting-started/intro).
{% /callout %}

# React Monorepo Tutorial - Part 1: Code Generation

## Contents

- [1 - Code Generation](/react-tutorial/1-code-generation)
- [2 - Project Graph](/react-tutorial/2-project-graph)
- [3 - Task Running](/react-tutorial/3-task-running)
- [4 - Workspace Optimization](/react-tutorial/4-workspace-optimization)
- [5 - Summary](/react-tutorial/5-summary)

## Your Objective

For this tutorial, you'll create two React applications, a React lib for your common components, and a library for your business logic as follows:

![Our Workspace Requirements](/shared/react-tutorial/requirements-diagram.svg)

## Creating an Nx Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · myorg
✔ Which stack do you want to use? · react
✔ What framework would you like to use? · none
✔ Standalone project or integrated monorepo? · integrated
✔ Application name · store
✔ Which bundler would you like to use? · vite
✔ Default stylesheet format             · css
✔ Enable distributed caching to make your CI faster · Yes
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

Once the command completes, notice two projects were added to the workspace:

- A React application located in `apps/store`.
- A Project for Cypress e2e tests for our `store` application in `apps/store-e2e`.

{% card title="Nx Cypress Support" description="While we see the Cypress project here, we won't go deeper on Cypress in this tutorial. You can find more materials on Nx Cypress support on the @nx/cypress package page." url="/packages/cypress" /%}

## Adding Another Application to Your Workspace

Run this command to create your `admin` app:

```{% command="npx nx g @nx/react:app admin" path="~/myorg" %}

>  NX  Generating @nx/react:application

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

![Nx Generator Syntax](/shared/react-tutorial/generator-syntax.svg)

## Generating Libraries

To create the `common-ui` and `products` libraries, use the `@nx/react:lib` and `@nx/js:lib` generators respectively:

```{% command="npx nx g @nx/react:lib common-ui" path="~/myorg" %}

> NX Generating @nx/react:library

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

```{% command="npx nx g @nx/js:lib products" path="~/myorg" %}

>  NX  Generating @nx/js:library

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

You should now be able to see all four projects of our design:

- `store` in `apps/store`
- `admin` in `apps/admin`
- `products` in `libs/products`
- `common-ui` in `libs/common-ui`

## What's Next

- Continue to [2: Project Graph](/react-tutorial/2-project-graph)
