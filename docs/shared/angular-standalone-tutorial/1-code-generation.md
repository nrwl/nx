---
title: 'Angular Standalone Tutorial - Part 1: Code Generation'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

{% callout type="check" title="Looking for Angular monorepos?" %}
This tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for a Angular monorepo setup then check out our [Angular monorepo tutorial](/angular-tutorial/1-code-generation).
{% /callout %}

{% youtube
src="https://www.youtube.com/embed/LYPVrWQNnEc"
title="Tutorial: Standalone Angular Application"
width="100%" /%}

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/standalone-angular-app" /%}

# Angular Standalone Tutorial - Part 1: Code Generation

## Contents

- [1 - Code Generation](/angular-standalone-tutorial/1-code-generation)
- [2 - Project Graph](/angular-standalone-tutorial/2-project-graph)
- [3 - Task Running](/angular-standalone-tutorial/3-task-running)
- [4 - Task Pipelines](/angular-standalone-tutorial/4-task-pipelines)
- [5 - Summary](/angular-standalone-tutorial/5-summary)

## Creating a New Workspace

Run the command `npx create-nx-workspace@latest` and when prompted, provide the following responses:

```{% command="npx create-nx-workspace@latest" path="~" %}

 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · store
✔ Which stack do you want to use? · angular
✔ Standalone project or integrated monorepo? · standalone
✔ Default stylesheet format             · css
✔ Would you like to use Standalone Components in your application? · No
✔ Would you like to add routing? · Yes
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

- An Angular application (`store`) with its configuration files at the root of the repo and source code in `src`.
- A project for Cypress e2e tests for our `store` application in `e2e`.

As far as Nx is concerned, the root-level `store` app owns every file that doesn't belong to a different project. So files in the `e2e` folder belong to the `e2e` project, everything else belongs to `store`.

{% card title="Nx Cypress Support" description="While we see the Cypress project here, we won't go deeper on Cypress in this tutorial. You can find more materials on Nx Cypress support on the @nx/cypress package page." url="/packages/cypress" /%}

## Generating a component for the store

```{% command="npx nx g @nx/angular:component shop --project=store" path="~/store" %}

>  NX  Generating @nx/angular:component

CREATE src/app/shop/shop.component.css
CREATE src/app/shop/shop.component.html
CREATE src/app/shop/shop.component.spec.ts
CREATE src/app/shop/shop.component.ts
UPDATE src/app/app.module.ts
```

![Nx Generator Syntax](/shared/angular-standalone-tutorial/generator-syntax.svg)

## Generating Libraries

To create the `cart` and `shared/ui` libraries, use the nx/angular:lib` generator:

```{% command="npx nx g @nx/angular:library cart" path="~/store" %}

>  NX  Generating @nx/angular:library

CREATE cart/README.md
CREATE cart/tsconfig.lib.json
CREATE cart/tsconfig.spec.json
CREATE cart/src/index.ts
CREATE cart/src/lib/cart.module.ts
CREATE cart/project.json
CREATE cart/tsconfig.json
UPDATE tsconfig.base.json
CREATE cart/jest.config.ts
CREATE cart/src/test-setup.ts
CREATE cart/.eslintrc.json
```

```{% command="npx nx g @nx/angular:lib shared/ui --buildable" path="~/store" %}

>  NX  Generating @nx/angular:library

UPDATE jest.config.ts
CREATE jest.config.app.ts
UPDATE project.json
CREATE shared/ui/README.md
CREATE shared/ui/ng-package.json
CREATE shared/ui/package.json
CREATE shared/ui/tsconfig.lib.json
CREATE shared/ui/tsconfig.lib.prod.json
CREATE shared/ui/tsconfig.spec.json
CREATE shared/ui/src/index.ts
CREATE shared/ui/src/lib/shared-ui.module.ts
CREATE shared/ui/project.json
CREATE shared/ui/tsconfig.json
UPDATE tsconfig.base.json
CREATE shared/ui/jest.config.ts
CREATE shared/ui/src/test-setup.ts
CREATE shared/ui/.eslintrc.json
UPDATE package.json

added 89 packages, removed 17 packages, changed 2 packages, and audited 1515 packages in 27s

201 packages are looking for funding
  run `npm fund` for details

8 low severity vulnerabilities

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

You should now be able to see all three projects of our design:

- `store` in the root
- `cart` in `cart`
- `shared-ui` in `shared/ui`

## What's Next

- Continue to [2: Project Graph](/angular-standalone-tutorial/2-project-graph)
