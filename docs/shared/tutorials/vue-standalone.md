---
title: 'Vue App Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building a Single Vue App with Nx

In this tutorial you'll learn how to use Vue with Nx in a ["standalone" (non-monorepo) setup](/concepts/integrated-vs-package-based#standalone-applications). Not to be confused with the "Vue Standalone API", a standalone project in Nx is a non-monorepo setup where you have a single application at the root level.

What are you going to learn?

- how to add Nx to a Vue project
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

We'll start out this tutorial using Nx together with a Vue application generated with the default `npm create vue` command. Later, we'll add the `@nx/vue` plugin to show the nice enhancements that it can provide. [Visit our "Why Nx" page](/getting-started/why-nx) to learn more about plugins and what role they play in the Nx architecture.

## Final Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/vue-app" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/vue-standalone?file=README.md" /%} -->

## Creating a new Vue App

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=49" /%} -->

Create a new Vue application with the following command:

```{% command="npm create vue vue-app --  --ts --jsx --router --vitest --playwright --eslint-with-prettier" path="~" %}

Vue.js - The Progressive JavaScript Framework

Scaffolding project in ~/vue-app...

Done. Now run:

  cd vue-app
  npm install
  npm run format
  npm run dev
```

Once you have run `npm install`, set up Git with the following commands:

```shell
git init
git add .
git commit -m "initial commit"
```

This command sets up a Vue app that uses Typescript and is configured to use the Vue router, Vitest for unit tests, Playwright for e2e tests and ESLint and Prettier for formatting. Your repository should now have the following structure:

```
└─ vue-app
   ├─ .vscode
   │  └─ extensions.json
   ├─ e2e
   │  ├─ tsconfig.json
   │  └─ vue.spec.ts
   ├─ public
   ├─ src
   │  ├─ assets
   │  ├─ components
   │  ├─ router
   │  ├─ views
   │  ├─ App.vue
   │  └─ main.ts
   ├─ .eslintrc.cjs
   ├─ .prettierrc.json
   ├─ index.html
   ├─ package.json
   ├─ playwright.config.ts
   ├─ README.md
   ├─ tsconfig.app.json
   ├─ tsconfig.json
   ├─ tsconfig.node.json
   ├─ tsconfig.vitest.json
   ├─ vite.config.ts
   └─ vitest.config.ts
```

The setup includes..

- a new Vue application at the root of the Nx workspace (`src`)
- a Playwright based set of e2e tests (`e2e/`)
- Prettier preconfigured
- ESLint preconfigured
- Vitest preconfigured

You can build the application with the following command:

```
npm run build
```

## Add Nx

Nx offers many features, but at its core, it is a task runner. Out of the box, it can:

- [cache your tasks](/features/cache-task-results)
- ensure those tasks are [run in the correct order](/features/run-tasks)

After the initial set up, you can incrementally add on other features that would be helpful in your organization.

To enable Nx in your repository, run a single command:

```shell {% path="~/vue-app" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it.

First, the script will propose installing some plugins based on the packages that are being used in your repository.

- Leave the plugins deselected so that we can explore what Nx provides without any plugins.

Second, the script asks a series of questions to help set up caching for you.

- `Which scripts are cacheable?` - Choose `test:e2e`, `build-only`, `type-check` and `lint`
- `Does the "test:e2e" script create any outputs?` - Enter `playwright-report`
- `Does the "build-only" script create any outputs?` - Enter `dist`
- `Does the "type-check" script create any outputs?` - Enter nothing
- `Does the "lint" script create any outputs?` - Enter nothing
- `Would you like remote caching to make your build faster?` - Choose `Skip for now`.

We'll enable Nx Cloud and add remote caching later in the tutorial.

## Caching Pre-configured

Nx has been configured to run your npm scripts as Nx tasks. You can run a single task like this:

```shell {% path="~/vue-app" %}
npx nx type-check vue-app
```

During the `init` script, Nx also configured caching for these tasks. You can see in the `nx.json` file that the scripts we identified as cacheable have the `cache` property set to `true` and the `build-only` target specifies that its output goes to the project's `dist` folder.

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "test:e2e": {
      "outputs": ["{projectRoot}/playwright-report"],
      "cache": true
    },
    "build-only": {
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "type-check": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Try running `type-check` for the `vue-app` app a second time:

```shell {% path="~/vue-app" %}
npx nx type-check vue-app
```

The first time `nx type-check` was run, it took about 2 seconds - just like running `npm run type-check`. But the second time you run `nx type-check`, it completes instantly and displays this message:

```text
Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

You can see the same caching behavior working when you run `npx nx lint`.

## Create a Task Pipeline

If you look at the `build` script in `package.json`, you'll notice that it is actually doing two things. It runs the `type-check` script and, in parallel, runs the `build-only` script.

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "run-p type-check \"build-only {@}\" --",
    "build-only": "vite build",
    "type-check": "vue-tsc --build --force"
  }
}
```

Instead of deciding ahead of time whether tasks need to be run in parallel or series, let's define the dependencies between tasks and then allow Nx to run them in the most efficient way possible. Update the `package.json` file with the following information:

```json {% fileName="package.json" highlightLines=[3] %}
{
  "scripts": {
    "build": "nx exec -- echo 'Ran type-check and build-only'",
    "build-only": "vite build",
    "type-check": "vue-tsc --build --force"
  }
}
```

Since the `build` command itself doesn't do anything, we can replace it with an echo to the console. The dependencies between the tasks we can define in the `dependsOn` property in the `nx.json` file:

```json {% fileName="nx.json" highlightLines=["3-5"] %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["type-check", "build-only"]
    }
  }
}
```

Whenever Nx runs the `build` task, it knows that the `type-check` and `build-only` tasks need to be run first. However, if the `build` script is run without using Nx (say with `npm run build`), the task dependencies will not be run. That's why we add the `nx exec --` command at the beginning of the `build` script in `package.json`. If you run `npm run build`, Nx will be used to run the task and any dependencies will be invoked correctly.

Now if you run `nx build vue-app`, Nx will run `type-check` and `build-only` first.

There's still one piece of functionality that was lost by this change. The `{@}` syntax in the original `build` script was used to forward command line arguments to the `build-only` script. To accomplish the same thing with Nx, instead of using a string for the `build-only` task dependency, we'll use an object and tell Nx to forward arguments on to that task.

```json {% fileName="nx.json" highlightLines=["6-9"] %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": [
        "type-check",
        {
          "target": "build-only",
          "params": "forward"
        }
      ]
    }
  }
}
```

If you run `nx build vue-app -l=error`, Nx will run the `build-only` script with a log level of error.

```text {% command="npx nx build" path="~/vue-app" %}
> nx run vue-app:type-check  [existing outputs match the cache, left as is]


> vue-app@0.0.0 type-check
> vue-tsc --build --force


> nx run vue-app:build-only  [local cache]


> vue-app@0.0.0 build-only
> vite build -l error


> nx run vue-app:build -l error


> vue-app@0.0.0 build
> nx exec -- echo 'Ran type-check and build-only' -l error

Ran type-check and build-only -l error

—————————————————————————————————————————————————————————————————————

 NX   Successfully ran target build for project vue-app and 2 tasks it depends on (456ms)

      With additional flags:
        --l=error
```

And once again, running `npx nx build` or `npm run build` twice will complete instantly.

## Use Nx Plugins to Enhance Vite Tasks with Caching

You may remember that we defined the `outputs` property in `nx.json` when we were answering questions in the `nx init` script. The value is currently hard-coded so that if you change the output path in your `vite.config.ts`, you have to remember to also change the `outputs` array in the `build` task configuration. This is where plugins can help. Plugins enable better integration with specific tools. The `@nx/vite` plugin can understand the `vite.config.ts` file and automatically create and configure tasks based on the settings in that file.

Nx plugins can:

- automatically configure caching for you, including inputs and outputs based on the underlying tooling configuration
- create tasks for a project using the tooling configuration files
- provide code generators to help scaffold out projects
- automatically keep the tooling versions and configuration files up to date

For this tutorial, we'll just focus on the automatic caching configuration.

First, let's delete the `outputs` array for the `build-only` task in `nx.json` so that we don't override the inferred values from the plugin. Your `nx.json` should look like this:

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "test:e2e": {
      "outputs": ["{projectRoot}/playwright-report"],
      "cache": true
    },
    "build": {
      "dependsOn": [
        "type-check",
        {
          "target": "build-only",
          "params": "forward"
        }
      ]
    },
    "build-only": {
      "cache": true
    },
    "type-check": {
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Now let's add the `@nx/vite` plugin:

```{% command="npx nx add @nx/vite" path="~/vue-app" %}
✔ Installing @nx/vite...
✔ Initializing @nx/vite...

 NX   Package @nx/vite added successfully.
```

The `nx add` command installs the version of the plugin that matches your repo's Nx version and runs that plugin's initialization script. For `@nx/vite`, the initialization script registers the plugin in the `plugins` array of `nx.json` and updates any `package.json` scripts that execute Vite related tasks. Open the project details view for the `vue-app` app and look at the `vite:build` task.

```shell {% path="~/vue-app" %}
npx nx show project vue-app
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/vue-app-pdv.json" %}
{% /project-details %}

If you hover over the settings for the `vite:build` task, you can see where those settings come from. The `inputs` and `outputs` are defined by the `@nx/vite` plugin from the `vite.config.ts` file where as the `dependsOn` property we set earlier in the tutorial is set in the `targetDefaults` in the `nx.json` file.

Now let's change where the `vite:build` results are output to in the `vite.config.ts` file.

```{% fileName="vite.config.ts" highlightLines=["10-12"] %}
import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx()],
  build: {
    outDir: 'dist/vue-app'
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
```

Now if you look at project details view again, you'll see that the `outputs` property for Nx's caching has been updated to stay in sync with the setting in the `vite.config.ts` file.

You can also add the `@nx/eslint` plugin to see how it infers `lint` tasks based on the ESLint configuration files.

```text
npx nx add @nx/eslint
```

## Creating New Components

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=500" /%} -->

You can just create new Vue components as you normally would. However, Nx plugins also ship [generators](/features/generate-code). They allow you to easily scaffold code, configuration or entire projects. Let's add the `@nx/vue` plugin to take advantage of the generators it provides.

```text
npx nx add @nx/vue
```

To see what capabilities the `@nx/vue` plugin ships, run the following command and inspect the output:

```{% command="npx nx list @nx/vue" path="~/vue-app" %}

NX   Capabilities in @nx/vue:

   GENERATORS

   init : Initialize the `@nx/vue` plugin.
   application : Create a Vue application.
   library : Create a Vue library.
   component : Create a Vue component.
   setup-tailwind : Set up Tailwind configuration for a project.
   storybook-configuration : Set up storybook for a Vue app or library.
   stories : Create stories for all components declared in an app or library.
```

{% callout type="info" title="Prefer a more visual UI?" %}

If you prefer a more integrated experience, you can install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the editor setup page](/getting-started/editor-setup).

{% /callout %}

Run the following command to generate a new "BaseButton" component. Note how we append `--dry-run` to first check the output.

```{% command="npx nx g @nx/vue:component BaseButton --no-export --skipTests --directory=src/components --dry-run" path="~/vue-app" %}
 NX  Generating @nx/vue:component

✔ Where should the component be generated? · src/components/BaseButton.vue
CREATE src/components/BaseButton.vue

NOTE: The "dryRun" flag means no changes were made.
```

As you can see it generates a new component in the `src/components/` folder. If you want to actually run the generator, remove the `--dry-run` flag.

```ts {% fileName="src/components/BaseButton.vue" %}
<script setup lang="ts">
// defineProps<{}>()
</script>

<template>
  <p>Welcome to BaseButton!</p>
</template>

<style scoped></style>
```

## You're ready to go!

In the previous sections you learned about the basics of using Nx, running tasks and navigating an Nx workspace. You're ready to ship features now!

But there's more to learn. You have two possibilities here:

- [Jump to the next steps section](#next-steps) to find where to go from here or
- keep reading and learn some more about what makes Nx unique when working with Vue.

## Modularize your Vue App with Local Libraries

When you develop your Vue application, usually all your logic sits in the `src` folder. Ideally separated by various folder names which represent your "domains". As your app grows, this becomes more and more monolithic though.

```
└─ vue-app
   ├─ ...
   ├─ src
   │  ├─ views
   │  │  ├─ products
   │  │  └─ cart
   │  ├─ components
   │  │  ├─ ui
   │  │  └─ ...
   │  ├─ App.vue
   │  └─ main.ts
   ├─ ...
   ├─ package.json
   ├─ ...
```

Nx allows you to separate this logic into "local libraries". The main benefits include

- better separation of concerns
- better reusability
- more explicit "APIs" between your "domain areas"
- better scalability in CI by enabling independent test/lint/build commands for each library
- better scalability in your teams by allowing different teams to work on separate libraries

### Create a Local Library

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for these areas using the Vue library generator:

```
nx g @nx/vue:library products --unitTestRunner=vitest --bundler=vite --directory=modules/products --component
```

Note how we use the `--directory` flag to place the library into a subfolder. You can choose whatever folder structure you like to organize your libraries.

Nx tries to set up your workspace to work with the modular library architecture, but depending on your existing configuration, you may need to tweak some settings. In this repo, you'll need to do a few things in order to prepare for future steps.

#### Lint Settings

We want the `lint` task for the root `vue-app` project to only lint the files for that project, so we'll change the `lint` command in `package.json`:

```json {% fileName="package.json" %}
{
  "scripts": {
    "lint": "eslint src --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore"
  }
}
```

Now we need to update the `.eslintrc.cjs` file to extend the `.eslintrc.base.json` file:

```js {% fileName=".eslintrc.cjs" highlightLines=[11,13] %}
/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
    './.eslintrc.base.json',
  ],
  ignorePatterns: ['!**/*'],
  overrides: [
    {
      files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
      extends: ['plugin:playwright/recommended'],
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
};
```

#### Build Settings

To make sure that the build can correctly pull in code from libraries, we need to move the typescript `paths` from the `tsconfig.app.json` file to the newly created `tsconfig.base.json` and extend that base file.

```json {% fileName="tsconfig.app.json" highlightLines=[2] %}
{
  "extends": ["@vue/tsconfig/tsconfig.dom.json", "./tsconfig.base.json"],
  "include": ["env.d.ts", "src/**/*", "src/**/*.vue"],
  "exclude": ["src/**/__tests__/*"]
}
```

```json {% fileName="tsconfig.vitest.json" highlightLines=[2] %}
{
  "extends": "./tsconfig.app.json",
  "exclude": [],
  "compilerOptions": {
    "lib": [],
    "types": ["node", "jsdom"]
  }
}
```

```json {% fileName="tsconfig.base.json" highlightLines=["5-8"] %}
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "products": ["modules/products/src/index.ts"]
    }
  }
}
```

We also need to update `vite.config.ts` to account for typescript aliases. Run the following generator to automatically update your configuration file.

```shell
npx nx g @nx/vite:setup-paths-plugin
```

This will update the `vite.config.ts` file to include the `nxViteTsPaths` plugin in the `plugins` array.

```ts {% fileName="vite.config.ts" highlightLines=[6,10] %}
import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), nxViteTsPaths()],
  build: {
    outDir: 'dist/vue-app',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
```

### Create More Libraries

Now that the repository is set up, let's generate the `orders` and `ui` libraries.

```
nx g @nx/vue:library orders --unitTestRunner=vitest --bundler=vite --directory=modules/orders --component
nx g @nx/vue:library ui --unitTestRunner=vitest --bundler=vite --directory=modules/shared/ui --component
```

Running the above commands should lead to the following directory structure:

```
└─ vue-app
   ├─ ...
   ├─ e2e/
   ├─ modules
   │  ├─ products
   │  │  ├─ .eslintrc.json
   │  │  ├─ README.md
   │  │  ├─ vite.config.ts
   │  │  ├─ package.json
   │  │  ├─ project.json
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  └─ lib
   │  │  │     ├─ products.spec.ts
   │  │  │     └─ products.vue
   │  │  ├─ tsconfig.json
   │  │  ├─ tsconfig.lib.json
   │  │  ├─ tsconfig.spec.json
   │  │  └─ vite.config.ts
   │  ├─ orders
   │  │  ├─ ...
   │  │  ├─ project.json
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  └─ ...
   │  │  └─ ...
   │  └─ shared
   │     └─ ui
   │        ├─ ...
   │        ├─ project.json
   │        ├─ src
   │        │  ├─ index.ts
   │        │  └─ ...
   │        └─ ...
   ├─ src
   │  ├─ components
   │  ├─ ...
   │  ├─ App.vue
   │  └─ main.tsx
   ├─ ...
```

Each of these libraries

- has a project details view where you can see the available tasks (e.g. running tests for just orders: `nx test orders`)
- has its own `project.json` file where you can customize targets
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the Vue Application

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@/*": ["./src/*"],
      "orders": ["modules/orders/src/index.ts"],
      "products": ["modules/products/src/index.ts"],
      "ui": ["modules/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

That way we can easily import them into other libraries and our Vue application. As an example, let's import the `Products` component from the `products` project into our main application. First, configure the router in the `src/router/index.ts`.

```tsx {% fileName="src/router/index.ts" %}
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('products').then((m) => m.Products),
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('orders').then((m) => m.Orders),
    },
  ],
});

export default router;
```

Then we can add links to the routes in `App.vue`.

```tsx {% fileName="src/App.vue" %}
<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
</script>

<template>
  <header>
    <img alt="Vue logo" class="logo" src="@/assets/logo.svg" width="125" height="125" />

    <div class="wrapper">
      <HelloWorld msg="You did it!" />

      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
        <RouterLink to="/products">Products</RouterLink>
        <RouterLink to="/orders">Orders</RouterLink>
      </nav>
    </div>
  </header>

  <RouterView />
</template>

...
```

Serving your app (`nx serve`) and then navigating to `/products` should give you the following result:

![products route](/shared/tutorials/vue-app-products-route.png)

## Visualizing your Project Structure

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=958" /%} -->

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `nx build`, identifying [affected projects](/features/run-tasks#run-tasks-on-projects-affected-by-a-pr) and more. Interestingly you can also visualize it.

Just run:

```shell
nx graph
```

You should be able to see something similar to the following in your browser (hint: click the "Show all projects" button).

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "vue-app",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "orders",
      "type": "lib",
      "data": {
        "tags": []
      }
    },

    {
      "name": "products",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "vue-app": [
      { "source": "vue-app", "target": "orders", "type": "dynamic" },
      { "source": "vue-app", "target": "products", "type": "dynamic" }
    ],
    "ui": [],
    "orders": [],
    "products": []
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

Notice how `ui` is not yet connected to anything because we didn't import it in any of our projects. Also the arrows to `orders` and `products` are dashed because we're using lazy imports.

Exercise for you: change the codebase so that `ui` is used by `orders` and `products`.

## Imposing Constraints with Module Boundary Rules

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=1147" /%} -->

Once you modularize your codebase you want to make sure that the modules are not coupled to each other in an uncontrolled way. Here are some examples of how we might want to guard our small demo workspace:

- we might want to allow `orders` to import from `shared-ui` but not the other way around
- we might want to allow `orders` to import from `products` but not the other way around
- we might want to allow all libraries to import the `shared-ui` components, but not the other way around

When building these kinds of constraints you usually have two dimensions:

- **type of project:** what is the type of your library. Example: "feature" library, "utility" library, "data-access" library, "ui" library (see [library types](/concepts/decisions/project-dependency-rules))
- **scope (domain) of the project:** what domain area is covered by the project. Example: "orders", "products", "shared" ... this really depends on the type of product you're developing

Nx comes with a generic mechanism that allows you to assign "tags" to projects. "tags" are arbitrary strings you can assign to a project that can be used later when defining boundaries between projects. For example, go to the `project.json` of your `orders` library and assign the tags `type:feature` and `scope:orders` to it.

```json {% fileName="modules/orders/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:orders"],
  ...
}
```

Then go to the `project.json` of your `products` library and assign the tags `type:feature` and `scope:products` to it.

```json {% fileName="modules/products/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:products"],
  ...
}
```

Finally, go to the `project.json` of the `shared-ui` library and assign the tags `type:ui` and `scope:shared` to it.

```json {% fileName="modules/shared/ui/project.json" %}
{
  ...
  "tags": ["type:ui", "scope:shared"],
  ...
}
```

Notice how we assign `scope:shared` to our UI library because it is intended to be used throughout the workspace.

Next, let's come up with a set of rules based on these tags:

- `type:feature` should be able to import from `type:feature` and `type:ui`
- `type:ui` should only be able to import from `type:ui`
- `scope:orders` should be able to import from `scope:orders`, `scope:shared` and `scope:products`
- `scope:products` should be able to import from `scope:products` and `scope:shared`

To enforce the rules, Nx ships with a custom ESLint rule.

### Lint Settings

We want the `lint` task for the root `react-app` project to only lint the files for that project (in the `src` folder), so we'll change the `lint` command in `package.json`:

```json {% fileName="package.json" %}
{
  "scripts": {
    "lint": "eslint src --ext .vue,.js,.jsx,.cjs,.mjs,.ts,.tsx,.cts,.mts --fix --ignore-path .gitignore"
  }
}
```

We need to update the `.eslintrc.cjs` file to extend the `.eslintrc.base.json` file and undo the `ignorePattern` from that config that ignores every file. The `.eslintrc.base.json` file serves as a common set of lint rules for every project in the repository.

```js {% fileName=".eslintrc.cjs" highlightLines=[11,13] %}
/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  root: true,
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting',
    './.eslintrc.base.json',
  ],
  ignorePatterns: ['!**/*'],
  overrides: [
    {
      files: ['e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
      extends: ['plugin:playwright/recommended'],
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
};
```

Now we need to update the `.eslintrc.base.json` file and define the `depConstraints` in the `@nx/enforce-module-boundaries` rule:

```json {% fileName=".eslintrc.base.json" highlightLines=["16-39"] %}
{
  "overrides": [
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      "rules": {
        "@nx/enforce-module-boundaries": [
          "error",
          {
            "enforceBuildableLibDependency": true,
            "allow": [],
            "depConstraints": [
              {
                "sourceTag": "*",
                "onlyDependOnLibsWithTags": ["*"]
              },
              {
                "sourceTag": "type:feature",
                "onlyDependOnLibsWithTags": ["type:feature", "type:ui"]
              },
              {
                "sourceTag": "type:ui",
                "onlyDependOnLibsWithTags": ["type:ui"]
              },
              {
                "sourceTag": "scope:orders",
                "onlyDependOnLibsWithTags": [
                  "scope:orders",
                  "scope:products",
                  "scope:shared"
                ]
              },
              {
                "sourceTag": "scope:products",
                "onlyDependOnLibsWithTags": ["scope:products", "scope:shared"]
              },
              {
                "sourceTag": "scope:shared",
                "onlyDependOnLibsWithTags": ["scope:shared"]
              }
            ]
          }
        ]
      }
    }
    ...
  ]
}
```

When Nx set up the `@nx/eslint` plugin, it chose a task name that would not conflict with the pre-existing `lint` script. Let's overwrite that name so that all the linting tasks use the same `lint` name. Update the setting in the `nx.json` file:

```json {% fileName="nx.json" highlightLines=[7] %}
{
  ...
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```

### Test Boundary Rules

To test the boundary rules, go to your `modules/products/src/lib/products.tsx` file and import the `Orders` from the `orders` project:

To test it, go to your `modules/products/src/lib/products.vue` file and import the `Orders` component from the `orders` project:

```tsx {% fileName="modules/products/src/lib/products.vue" %}
<script setup lang="ts">
defineProps<{}>();

// 👇 this import is not allowed
import { Orders } from 'orders';
</script>

<template>
  <p>Welcome to Products!</p>
</template>

<style scoped></style>
```

If you lint your workspace you'll get an error now:

```{% command="nx run-many -t lint" %}
   ✔  nx run ui:lint  [existing outputs match the cache, left as is]
   ✔  nx run orders:lint  [existing outputs match the cache, left as is]

——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————
   ✖  nx run products:lint
      > eslint .

      ~/vue-app/modules/products/src/lib/products.vue
        5:1  error  A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries

      ✖ 1 problem (1 error, 0 warnings)

   ✔  nx run vue-app:lint (892ms)
   ✔  nx run vue-app:lint (1s)

——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Ran targets lint for 4 projects (1s)

   ✔  4/5 succeeded [2 read from cache]

   ✖  1/5 targets failed, including the following:

      - nx run products:lint
```

Learn more about how to [enforce module boundaries](/features/enforce-module-boundaries).

## Migrating to a Monorepo

When you are ready to add another application to the repo, you'll probably want to move `myvueapp` to its own folder. To do this, you can run the [`convert-to-monorepo` generator](/nx-api/workspace/generators/convert-to-monorepo) or [manually move the configuration files](/recipes/tips-n-tricks/standalone-to-integrated).

## Set Up CI for Your Vue App

This tutorial walked you through how Nx can improve the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Generate a CI Workflow

If you are starting a new project, you can use the following command to generate a CI workflow file.

```shell
npx nx generate ci-workflow --ci=github
```

{% callout type="note" title="Choose your CI provider" %}
You can choose `github`, `circleci`, `azure`, `bitbucket-pipelines`, or `gitlab` for the `ci` flag.
{% /callout %}

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR.

The key line in the CI pipeline is:

```yml
- run: npx nx affected -t lint test build e2e-ci
```

### Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

To connect to Nx Cloud:

- Commit and push your changes
- Go to [https://cloud.nx.app](https://cloud.nx.app), create an account, and connect your repository

#### Connect to Nx Cloud Manually

If you are not able to connect via the automated process at [https://cloud.nx.app](https://cloud.nx.app), you can connect your workspace manually by running:

```shell
npx nx connect
```

You will then need to merge your changes and connect to your workspace on [https://cloud.nx.app](https://cloud.nx.app).

### Enable a Distributed CI Pipeline

The current CI pipeline runs on a single machine and can only handle small workspaces. To transform your CI into a CI that runs on multiple machines and can handle workspaces of any size, uncomment the `npx nx-cloud start-ci-run` line in the `.github/workflows/ci.yml` file.

```yml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="e2e-ci"
```

For more information about how Nx can improve your CI pipeline, check out one of these detailed tutorials:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Next Steps

Connect with the rest of the Nx community with these resources:

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
