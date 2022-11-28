---
title: 'React Standalone Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

{% callout type="check" title="Standalone Repo" %}
This tutorial sets up a repo with one main application that breaks out its code into libraries to add structure.

You can find more information on about other repo styles in [our introduction](/getting-started/intro).
{% /callout %}

# React Tutorial - Part 1: Code Generation

## Contents

- [1 - Code Generation](/react-standalone-tutorial/1-code-generation)
- [2 - Project Graph](/react-standalone-tutorial/2-project-graph)
- [3 - Task Running](/react-standalone-tutorial/3-task-running)
- [4 - Workspace Optimization](/react-standalone-tutorial/4-workspace-optimization)
- [5 - Summary](/react-standalone-tutorial/5-summary)

## Your Objective

This tutorial sets up a repo with one main React application, two React libraries for routes and a third library for shared UI components. There is also an e2e project generated for you, that we won't cover in this tutorial.

{% graph height="450px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "routes-cart",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "e2e",
      "type": "e2e",
      "data": {
        "tags": []
      }
    },
    {
      "name": "store",
      "type": "app",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "routes-cart": [
      { "source": "routes-cart", "target": "shared-ui", "type": "static" }
    ],
    "shared-ui": [],
    "e2e": [{ "source": "e2e", "target": "store", "type": "implicit" }],
    "store": [
      { "source": "store", "target": "routes-cart", "type": "static" },
      { "source": "store", "target": "shared-ui", "type": "static" }
    ]
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

## Creating an Nx Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Choose what to create                 · react
✔ Repository name                       · myorg
✔ Application name                      · store
✔ Default stylesheet format             · css
✔ Enable distributed caching to make your CI faster · No
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

Once the command completes, notice two projects were added to the workspace:

- A React application (`store`) with its configuration files at the root of the repo and source code in `src`.
- A Project for Cypress e2e tests for our `store` application in `e2e`.

As far as Nx is concerned, the root-level `store` app owns every file that doesn't belong to a different project. So files in the `e2e` folder belong to the `e2e` project, everything else belongs to `store`.

{% card title="Nx Cypress Support" description="While we see the Cypress project here, we won't go deeper on Cypress in this tutorial. You can find more materials on Nx Cypress support on the @nrwl/cypress package page." url="/packages/cypress" /%}

## Generating a component for the store

```{% command="npx nx g @nrwl/react:component shop --project=store" path="~/myorg" %}

>  NX  Generating @nrwl/react:component

✔ Should this component be exported in the project? (y/N) · false
CREATE src/app/shop/shop.module.css
CREATE src/app/shop/shop.spec.tsx
CREATE src/app/shop/shop.tsx
```

![Nx Generator Syntax](/shared/react-standalone-tutorial/generator-syntax.svg)

## Generating Libraries

To create the `routes/cart` and `shared/ui` libraries, use the `@nrwl/react:lib` generator:

{% side-by-side %}

```{% command="npx nx g @nrwl/react:library routes/cart" path="~/myorg" %}

>  NX  Generating @nrwl/react:library

✔ Which bundler would you like to use to build the library? · vite
UPDATE nx.json
CREATE routes/cart/project.json
CREATE .eslintrc.store.json
UPDATE project.json
UPDATE .eslintrc.json
UPDATE e2e/.eslintrc.json
CREATE routes/cart/.eslintrc.json
CREATE routes/cart/README.md
CREATE routes/cart/package.json
CREATE routes/cart/src/index.ts
CREATE routes/cart/tsconfig.json
CREATE routes/cart/tsconfig.lib.json
CREATE routes/cart/index.html
CREATE routes/cart/src/demo.tsx
UPDATE tsconfig.base.json
UPDATE package.json
CREATE routes/cart/vite.config.ts
CREATE routes/cart/tsconfig.spec.json
CREATE routes/cart/src/lib/routes-cart.module.css
CREATE routes/cart/src/lib/routes-cart.spec.tsx
CREATE routes/cart/src/lib/routes-cart.tsx
```

```{% command="npx nx g @nrwl/react:lib shared/ui" path="~/myorg" %}

>  NX  Generating @nrwl/react:library

✔ Which bundler would you like to use to build the library? · vite
UPDATE nx.json
CREATE shared/ui/project.json
CREATE shared/ui/.eslintrc.json
CREATE shared/ui/README.md
CREATE shared/ui/package.json
CREATE shared/ui/src/index.ts
CREATE shared/ui/tsconfig.json
CREATE shared/ui/tsconfig.lib.json
CREATE shared/ui/index.html
CREATE shared/ui/src/demo.tsx
UPDATE tsconfig.base.json
CREATE shared/ui/vite.config.ts
CREATE shared/ui/tsconfig.spec.json
CREATE shared/ui/src/lib/shared-ui.module.css
CREATE shared/ui/src/lib/shared-ui.spec.tsx
CREATE shared/ui/src/lib/shared-ui.tsx
```

{% /side-by-side %}

You should now be able to see all three projects of our design:

- `store` in the root
- `routes-cart` in `routes/cart`
- `shared-ui` in `shared/ui`

## What's Next

- Continue to [2: Project Graph](/react-standalone-tutorial/2-project-graph)
