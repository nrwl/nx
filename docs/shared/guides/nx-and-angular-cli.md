---
title: Nx and the Angular CLI
description: Compare Nx and Angular CLI features, understand similarities and differences, and learn how Nx enhances Angular development with improved caching, monorepo support, and advanced tooling.
---

# Nx and the Angular CLI

{% youtube
src="https://www.youtube.com/embed/bwPkz4MrPDI?si=OLPUENWXLkQ9GRtR"
title="Nx vs Angular CLI - The Showdown"
width="100%" /%}

Nx evolved from being an extension of the Angular CLI to a [fully standalone CLI working with multiple frameworks](/getting-started/intro#start-small-extend-as-you-grow). As a result, adopting Nx as an Angular user is relatively straightforward. This guide explores some of the similarities and in particular, added benefits of using Nx over the Angular CLI for your Angular project.

## TL;DR: Why should I use Nx for my Angular project?

Nx...

- helps define clear architectural guidelines and promotes best practices to organize and scale your codebase.
- helps integrate modern tooling by actively working with devtool authors to make sure they work well with Nx and your framework of choice.
- is adaptable: start small with a single-project setup and grow it to a monorepo when needed.
- has an active community of contributors and plugin authors.
- has been proven in large enterprise-level projects.

Note, the Nx team's focus is on building the best possible developer productivity tool.

### Quick Overview Comparison

Here's a quick side-by-side overview comparing the features between the Angular CLI and Nx. _(Kudos to [Daniel Glejzner](https://twitter.com/DanielGlejzner) for helping with this)_

| Feature/Tool                                                                                          | Angular CLI     | Nx            |
| ----------------------------------------------------------------------------------------------------- | --------------- | ------------- |
| Create Angular Apps                                                                                   | ✅              | ✅            |
| Generate Angular Components, Services, etc.                                                           | ✅              | ✅            |
| Building & Bundling                                                                                   | ✅              | ✅            |
| Local Development Server                                                                              | ✅              | ✅            |
| Code Schematics                                                                                       | ✅              | ✅            |
| Automated Update with Migrations                                                                      | ✅              | ✅ (Enhanced) |
| Generators                                                                                            | ✅ (Schematics) | ✅            |
| Executors                                                                                             | ✅ (Builders)   | ✅            |
| Advanced Generators (e.g. Module Federation, Tailwind,...)                                            | ❌              | ✅            |
| Integrated Tooling (Jest, Cypress, Playwright etc.)                                                   | ❌              | ✅            |
| Support for single-project Workspaces                                                                 | ✅              | ✅            |
| First-Class [Monorepo Support](/getting-started/tutorials/angular-monorepo-tutorial)                  | ❌\*            | ✅            |
| [Enforced Module Boundaries](/features/enforce-module-boundaries)                                     | ❌              | ✅            |
| Interactive [Project Graph](/features/explore-graph)                                                  | ❌              | ✅            |
| Task Graph                                                                                            | ❌              | ✅            |
| [Running Tasks in Parallel](/recipes/running-tasks/run-tasks-in-parallel)                             | ❌              | ✅            |
| Building, Testing [Only What is Affected](/features/run-tasks#run-tasks-on-projects-affected-by-a-pr) | ❌              | ✅            |
| [Local Caching](/features/cache-task-results)                                                         | ❌\*\*          | ✅            |
| [Remote Caching](/ci/features/remote-cache)                                                           | ❌              | ✅            |
| [Distributed Task Execution on CI](/ci/features/distribute-task-execution)                            | ❌              | ✅            |
| Custom Hashers                                                                                        | ❌              | ✅            |
| [Extensible Plugin System](/extending-nx/intro/getting-started)                                       | ❌              | ✅            |

{% callout type="info" title="Notes" %}

\* You can setup a monorepo with the Angular CLI creating buildable Angular ng-packagr projects, but the DX is not as optimized compared to what you'd get with Nx.

\*\* The Angular CLI has a [caching mechanism](https://angular.dev/cli/cache) which persists the Webpack/ESBuild/"TS incremental build info" cache to disk. Nx leverages that cache as well but in addition adds a more powerful process-level caching on top that is framework agnostic.

{% /callout %}

## Similarities and Differences

Learn about the similarities between the Angular CLI and Nx which makes it easy to [migrate](#migrate-from-the-angular-cli) but also about how Nx goes beyond to further improve your developer productivity.

### Not just for Monorepos: Project Setup & Structure

Nx is not just exclusively for monorepos, but can create

- a single-project workspace (basically what the Angular CLI gives you)
- a monorepo workspace (multiple projects in a single repo)

### Generate a new project

You can create a new Nx single-project workspace using the following command:

```shell
npx create-nx-workspace myngapp --preset=angular-standalone
```

{% callout type="note" title="Want a monorepo instead?" %}
You can use the `--preset=angular-monorepo` to start with a monorepo structure. Note, however, that you can start simple and migrate to a monorepo later.
{% /callout %}

The single-project workspace setup follows a similar structure to what the Angular CLI generates.

```plaintext
└─ myngapp
   ├─ public
   │  └─ favicon.ico
   ├─ src
   │  ├─ app
   │  │  ├─ app.config.ts
   │  │  ├─ app.css
   │  │  ├─ app.html
   │  │  ├─ app.routes.ts
   │  │  ├─ app.spec.ts
   │  │  ├─ app.ts
   │  │  └─ nx-welcome.ts
   │  ├─ index.html
   │  ├─ main.ts
   │  ├─ styles.css
   │  └─ test-setup.ts
   ├─ nx.json
   ├─ package.json
   ├─ project.json
   ├─ tsconfig.app.json
   ├─ tsconfig.json
   └─ tsconfig.spec.json
```

### project.json vs angular.json

Nx configures projects and their targets in a format similar to `angular.json`. However, instead of storing the configuration for every project in a single large `angular.json` file at the root, the configuration is split into multiple `project.json` files, one for each project.

Smaller, focused config files allow you to quickly find the relevant configuration for the project you are working on, and editing a single project configuration does not cause the `nx affected` command to rerun all the tests in the repo. This conversion is done automatically when you run `nx init`.

Note that even though the configuration is split, everything works similarly. Migrations and schematics written with the Angular devkit that expect a single `angular.json` file will receive a single file. Nx is smart, so it merges all the files in memory to make those migrations and schematics work.

More details: Nx [project configuration](/reference/project-configuration).

### Executors vs. Builders, Generators vs. Schematics

Nx comes with slightly different terminology than the Angular CLI for some features.

**Angular Builders** are called [Executors](/concepts/executors-and-configurations) in Nx but work very much similarly. You use them in your project configuration to define how to build, test, lint, and serve your project. You can use both Nx executors from [Nx Plugins](/plugin-registry) or Angular Builders from the Angular Devkit.

```json
{
  "name": "myngapp",
  ...
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:browser",
      ...
    },
    ...
  }
}
```

**Angular Schematics** are called [Generators](/features/generate-code) in Nx. You can invoke them in the same way as you would with the Angular CLI, but you use the `nx` command instead of `ng`:

```shell
npx nx g @nx/angular:component apps/my-app/src/lib/my-component/my-component
```

You can also run Angular Schematics through the Nx CLI. So something like this works as well:

```shell
npx nx g @schematics/angular:component my-component
```

{% callout type="check" title="Important" %}
Support to run Angular Devkit builders and schematics is enabled by installing the [`@nx/angular` plugin](/technologies/angular/introduction). This plugin is installed by default when creating a new Angular workspace with Nx or [migrate an existing Angular CLI workspace to Nx](#migrate-from-the-angular-cli).
{% /callout %}

### Running Commands

Commands are run in the very same way as with the Angular CLI. You just switch `ng` with `nx`. For example:

```shell
npx nx serve
```

Nx has more abilities to run commands in parallel, just for specific projects etc. Find out more [in the docs](/features/run-tasks).

### Integrating with Modern Tools

An Angular-based Nx Workspace already comes with a lot of batteries included:

- Prettier preconfigured
- ESLint
- e2e testing with [Cypress](https://www.cypress.io/) or [Playwright](https://playwright.dev/)
- unit testing with [Jest](https://jestjs.io/)

But Nx expands beyond just that, offering automated integration with a lot of modern tools such as [Storybook](https://storybook.js.org/) or [Tailwind](https://tailwindcss.com/) just to mention a few.

### 'ng update' vs. 'nx migrate'

Like the Angular CLI, Nx has a command that allows you to upgrade your existing workspace tools, packages, and source code to the next version. Instead of `ng update`, you run `nx migrate`:

```shell
npx nx migrate latest
```

What's the difference?

`nx migrate` is a much-improved version of `ng update`. It runs the same migrations but allows you to:

- Rerun the same migration multiple times.
- Reorder migrations.
- Skip migrations.
- Fix migrations that "almost work".
- Commit a partially migrated state.
- Change versions of packages to match org requirements.
- [Opt out of Angular updates when updating Nx versions](/recipes/tips-n-tricks/advanced-update#choosing-optional-package-updates-to-apply) as long as [the Angular version is still supported](/technologies/angular/recipes/angular-nx-version-matrix)

`nx migrate` does this by splitting the process into two steps. `nx migrate latest` creates a `migrations.json` file with a list of all the migrations needed by Nx, Angular, and other packages. You can then modify that file before running `nx migrate --run-migrations` to execute those migrations.

To reiterate: `nx migrate` runs the migrations written by the Angular team the same way `ng update` runs them. So everything should still work. You just get more control over how it works. You can learn more in our docs about [Automate Updating Dependencies](/features/automate-updating-dependencies).

### 'nx add'

The [`nx add` command](/reference/core-api/nx/documents/add) is similar to the `ng add` command. It installs a given package specifier (e.g. `@nx/react`, `@nx/react@18.1.0`, `@nx/react@latest`) and it runs an `init` or `ng-add` generator if the installed package contains it.

```shell
nx add [package]
```

The command was introduced in **Nx 17.3.0**. If you're using an older version, you can instead run:

{% tabs %}
{% tab label="npm" %}

```shell
npm add [package]
nx g [package]:ng-add
```

{% /tab %}

{% tab label="yarn" %}

```shell
yarn add [package]
nx g [package]:ng-add
```

{% /tab %}

{% tab label="pnpm" %}

```shell
pnpm add [package]
nx g [package]:ng-add
```

{% /tab %}

{% tab label="bun" %}

```shell
bun add [package]
nx g [package]:ng-add
```

{% /tab %}
{% /tabs %}

Replace `[package]` with the package name you're trying to add.

### Speed

Nx is designed to be fast. The Angular CLI leverages Webpack's caching, which Nx also does since it relies on the Angular Devkit when it comes to compiling or running apps. But Nx goes way beyond that, introducing features vital for a fast CI experience, mainly when you have a monorepo.

Features like

- only running tasks on [affected projects](/ci/features/affected)
- running [tasks in parallel](/features/run-tasks#run-tasks-for-multiple-projects)
- applying [computation caching](/features/cache-task-results)
- offering [remote caching abilities](/ci/features/remote-cache) on CI
- offering [task distribution across machines (Nx Agents)](/ci/features/distribute-task-execution)

And, Nx already uses fast, modern tooling like [ESBuild](/technologies/build-tools/esbuild/introduction), [Vite](/technologies/build-tools/vite/introduction), Vitest and [Rspack](/technologies/build-tools/rspack/introduction) for non-Angular stacks. So once Angular is ready to use these tools, Nx will also be ready.

### Editor Integration

Nx goes beyond being just a CLI and comes with [Nx Console](/getting-started/editor-setup), a VSCode and WebStorm extension allowing you to run commands, generate code and visualize your workspace.

![Nx Console screenshot](/shared/images/nx-console/nx-console-screenshot.webp)

### Scaling: Start Simple, Grow to a Monorepo

Nx is really made to scale with you. You can

- start small with a single-project workspace
- modularize your application into more fine-grained libraries for better maintainability as your application (and team) grows, including mechanisms to make sure [things stay within their boundaries](/features/enforce-module-boundaries)
- you can then migrate to a monorepo when you are ready and need one ([more here](/recipes/tips-n-tricks/standalone-to-monorepo))
- or even [add Webpack Module Federation support](/technologies/angular/recipes/module-federation-with-ssr)

### Visualize your Workspace

As you start modularizing your Angular workspace, Nx can visualize it using the `nx graph` command or via [Nx Console](/getting-started/editor-setup) directly in your editor.

{% graph height="450px" %}

```json
{
  "hash": "58420bb4002bb9b6914bdeb7808c77a591a089fc82aaee11e656d73b2735e3fa",
  "projects": [
    {
      "name": "shared-product-state",
      "type": "lib",
      "data": {
        "tags": ["scope:shared", "type:state"]
      }
    },
    {
      "name": "shared-product-types",
      "type": "lib",
      "data": {
        "tags": ["type:types", "scope:shared"]
      }
    },
    {
      "name": "shared-product-data",
      "type": "lib",
      "data": {
        "tags": ["type:data", "scope:shared"]
      }
    },
    {
      "name": "cart-cart-page",
      "type": "lib",
      "data": {
        "tags": ["scope:cart", "type:feature"]
      }
    },
    {
      "name": "shared-styles",
      "type": "lib",
      "data": {
        "tags": ["scope:shared", "type:styles"]
      }
    },
    {
      "name": "cart-e2e",
      "type": "e2e",
      "data": {
        "tags": ["scope:cart", "type:e2e"]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
        "tags": ["type:app", "scope:cart"]
      }
    }
  ],
  "dependencies": {
    "shared-product-state": [
      {
        "source": "shared-product-state",
        "target": "shared-product-data",
        "type": "static"
      },
      {
        "source": "shared-product-state",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-product-types": [],
    "shared-product-data": [
      {
        "source": "shared-product-data",
        "target": "shared-product-types",
        "type": "static"
      }
    ],
    "shared-e2e-utils": [],
    "cart-cart-page": [
      {
        "source": "cart-cart-page",
        "target": "shared-product-state",
        "type": "static"
      }
    ],
    "shared-styles": [],
    "cart-e2e": [
      { "source": "cart-e2e", "target": "cart", "type": "implicit" }
    ],
    "cart": [
      { "source": "cart", "target": "shared-styles", "type": "implicit" },
      { "source": "cart", "target": "cart-cart-page", "type": "static" }
    ]
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": [],
  "enableTooltips": true
}
```

{% /graph %}

Learn more about the [graph features here](/features/explore-graph).

### Extensible and Customizable: Make it fit your own needs

Nx is [built to be extensible](/getting-started/intro#start-small-extend-as-you-grow). Just like the [packages published by the Nx core team](/plugin-registry) you can create your own Nx plugins by [extending Nx](/extending-nx/intro/getting-started). This can be as simple as using [run-commands](/reference/core-api/nx/executors/run-commands) to integrate custom commands into the project configuration or as complex as [creating your own local executor](/extending-nx/recipes/local-executors).

And if you ever need to expand beyond Angular or diversify your stack, you can still keep using Nx, which is [battle-tested with many different technologies](/technologies).

## Migrate from the Angular CLI?

Migrating an Angular CLI project to Nx can be done by running

```shell
npx nx@latest init
```

or alternatively using the `--integrated` flag if you want to create an Nx monorepo right away. Learn more about all the details on the [dedicated docs page](technologies/angular/migration/angular).

There is also a guide describing how to [consolidate multiple Angular CLI projects into a single Nx monorepo](technologies/angular/migration/angular-multiple).

You can learn more about Angular & Nx by following our dedicated tutorials:

- [Tutorial: Building Angular Apps in an Nx Monorepo](/getting-started/tutorials/angular-monorepo-tutorial)
