---
title: 'Angular Monorepo Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

{% callout type="check" title="Two Styles of Repo" %}
There are two styles of repos: integrated and package-based. This tutorial shows the integrated style.

You can find more information on the difference between the two in [our introduction](/getting-started/intro).
{% /callout %}

# Angular Monorepo Tutorial - Part 1: Code Generation

## Contents

- [1 - Code Generation](/angular-tutorial/1-code-generation)
- [2 - Project Graph](/angular-tutorial/2-project-graph)
- [3 - Task Running](/angular-tutorial/3-task-running)
- [4 - Workspace Optimization](/angular-tutorial/4-workspace-optimization)
- [5 - Summary](/angular-tutorial/5-summary)

## Your Objective

For this tutorial, you'll create two Angular applications, an Angular lib for your common components, and a library for your business logic as follows:

![Our Workspace Requirements](/shared/angular-tutorial/requirements-diagram.svg)

## Creating an Nx Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · myorg
✔ Which stack do you want to use? · angular
✔ Standalone project or integrated monorepo? · integrated
✔ Application name · store
✔ Default stylesheet format             · css
✔ Would you like to use Standalone Components in your application? · No
✔ Would you like to add routing? · Yes
✔ Enable distributed caching to make your CI faster · Yes
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

Once the command completes, notice two projects were added to the workspace:

- An Angular application located in `apps/store`.
- A Project for Cypress e2e tests for our `store` application in `apps/store-e2e`.

{% card title="Nx Cypress Support" description="While we see the Cypress project here, we won't go deeper on Cypress in this tutorial. You can find more materials on Nx Cypress support on the @nx/cypress package page." url="/packages/cypress" /%}

## Adding Another Application to Your Workspace

Run this command to create your `admin` app:

```{% command="npx nx g @nx/angular:app admin" path="~/myorg" %}
npx nx g @nx/angular:app admin

>  NX  Generating @nx/angular:application

✔ Would you like to configure routing for this application? (y/N) · false
[NX] Angular devkit called `writeWorkspace`, this may have created 'workspace.json' or 'angular.json
[NX] Double check workspace configuration before proceeding
Skipping admin since apps/admin/project.json already exists.
CREATE apps/admin/tsconfig.app.json
CREATE apps/admin/tsconfig.spec.json
CREATE apps/admin/src/favicon.ico
CREATE apps/admin/src/index.html
CREATE apps/admin/src/main.ts
CREATE apps/admin/src/styles.css
CREATE apps/admin/src/assets/.gitkeep
CREATE apps/admin/src/app/app.module.ts
CREATE apps/admin/src/app/app.component.css
CREATE apps/admin/src/app/app.component.html
CREATE apps/admin/src/app/app.component.spec.ts
CREATE apps/admin/src/app/app.component.ts
CREATE apps/admin/project.json
CREATE apps/admin/tsconfig.editor.json
CREATE apps/admin/tsconfig.json
CREATE apps/admin/src/app/nx-welcome.component.ts
CREATE apps/admin/.eslintrc.json
CREATE apps/admin/jest.config.ts
CREATE apps/admin/src/test-setup.ts
CREATE apps/admin-e2e/cypress.config.ts
CREATE apps/admin-e2e/src/e2e/app.cy.ts
CREATE apps/admin-e2e/src/fixtures/example.json
CREATE apps/admin-e2e/src/support/app.po.ts
CREATE apps/admin-e2e/src/support/commands.ts
CREATE apps/admin-e2e/src/support/e2e.ts
CREATE apps/admin-e2e/tsconfig.json
CREATE apps/admin-e2e/project.json
CREATE apps/admin-e2e/.eslintrc.json
```

![Nx Generator Syntax](/shared/angular-tutorial/generator-syntax.svg)

## Generating Libraries

To create the `common-ui` and `products` libraries, use the `@nx/angular:lib` and `@nx/js:lib` generators respectively:

```{% command="npx nx g @nx/angular:lib common-ui" path="~/myorg" %}

>  NX  Generating @nx/angular:library

[NX] Angular devkit called `writeWorkspace`, this may have created 'workspace.json' or 'angular.json
[NX] Double check workspace configuration before proceeding
Skipping common-ui since libs/common-ui/project.json already exists.
CREATE libs/common-ui/README.md
CREATE libs/common-ui/tsconfig.lib.json
CREATE libs/common-ui/tsconfig.spec.json
CREATE libs/common-ui/src/index.ts
CREATE libs/common-ui/src/lib/common-ui.module.ts
CREATE libs/common-ui/project.json
CREATE libs/common-ui/tsconfig.json
UPDATE tsconfig.base.json
CREATE libs/common-ui/jest.config.ts
CREATE libs/common-ui/src/test-setup.ts
CREATE libs/common-ui/.eslintrc.json
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

- Continue to [2: Project Graph](/angular-tutorial/2-project-graph)
