---
title: 'React Standalone Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

{% callout type="check" title="Looking for React monorepos?" %}
This tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for a React monorepo setup then check out our [React monorepo tutorial](/react-tutorial/1-code-generation).

{% /callout %}

{% youtube
src="https://www.youtube.com/embed/dqCZteGFP4k"
title="Tutorial: React Standalone Application"
width="100%" /%}

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/standalone-react-app" /%}

# React Standalone Tutorial - Part 1: Code Generation

## Contents

- [1 - Code Generation](/react-standalone-tutorial/1-code-generation)
- [2 - Project Graph](/react-standalone-tutorial/2-project-graph)
- [3 - Task Running](/react-standalone-tutorial/3-task-running)
- [4 - Task Pipelines](/react-standalone-tutorial/4-task-pipelines)
- [5 - Summary](/react-standalone-tutorial/5-summary)

## Creating a New Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · store
✔ Which stack do you want to use? · react
✔ What framework would you like to use? · none
✔ Standalone project or integrated monorepo? · standalone
✔ Which bundler would you like to use? · vite
✔ Default stylesheet format             · css
✔ Enable distributed caching to make your CI faster · Yes
```

{% card title="Opting into Nx Cloud" description="You will also be prompted whether to add Nx Cloud to your workspace. We won't address this in this tutorial, but you can see the introduction to Nx Cloud for more details." url="/nx-cloud/intro/what-is-nx-cloud" /%}

Once the command completes, the file structure should look like this:

```treeview
store/
├── e2e/
├── src/
├── tools/
├── nx.json
├── package.json
├── project.json
├── README.md
├── tsconfig.base.json
└── tsconfig.json
```

There are two projects that have been created for you:

- A React application (`store`) with its configuration files at the root of the repo and source code in `src`.
- A project for Cypress e2e tests for our `store` application in `e2e`.

As far as Nx is concerned, the root-level `store` app owns every file that doesn't belong to a different project. So files in the `e2e` folder belong to the `e2e` project, everything else belongs to `store`.

{% card title="Nx Cypress Support" description="While we see the Cypress project here, we won't go deeper on Cypress in this tutorial. You can find more materials on Nx Cypress support on the @nx/cypress package page." url="/packages/cypress" /%}

## Generating a Component for the Store

```{% command="npx nx g @nx/react:component shop" path="~/store" %}

>  NX  Generating @nx/react:component

✔ Which stylesheet format would you like to use? · css
✔ Should this component be exported in the project? (y/N) · false
CREATE src/app/shop/shop.module.css
CREATE src/app/shop/shop.spec.tsx
CREATE src/app/shop/shop.tsx
```

![Nx Generator Syntax](/shared/react-standalone-tutorial/generator-syntax.svg)

## Generating Libraries

To create the `cart` and `shared/ui` libraries, use the `@nx/react:lib` generator:

```{% command="npx nx g @nx/react:library cart" path="~/store" %}

>  NX  Generating @nx/react:library
✔ Which stylesheet format would you like to use? · css
✔ What unit test runner should be used? · vitest
✔ Which bundler would you like to use to build the library? · vite
UPDATE nx.json
CREATE cart/project.json
CREATE .eslintrc.base.json
UPDATE project.json
UPDATE .eslintrc.json
UPDATE e2e/.eslintrc.json
CREATE cart/.eslintrc.json
CREATE cart/README.md
CREATE cart/package.json
CREATE cart/src/index.ts
CREATE cart/tsconfig.json
CREATE cart/tsconfig.lib.json
CREATE cart/index.html
CREATE cart/src/demo.tsx
UPDATE tsconfig.base.json
UPDATE package.json
CREATE cart/vite.config.ts
CREATE cart/tsconfig.spec.json
CREATE cart/src/lib/cart.module.css
CREATE cart/src/lib/cart.spec.tsx
CREATE cart/src/lib/cart.tsx
```

```{% command="npx nx g @nx/react:lib shared/ui" path="~/store" %}

>  NX  Generating @nx/react:library

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

You should now be able to see all three projects of our design:

- `store` in the root
- `cart` in `cart`
- `shared-ui` in `shared/ui`

## What's Next

- Continue to [2: Project Graph](/react-standalone-tutorial/2-project-graph)
