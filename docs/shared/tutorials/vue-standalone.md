# Building Vue Apps with the Nx Standalone Projects Setup

In this tutorial you'll learn how to use Vue with Nx in a ["standalone" (non-monorepo) setup](/concepts/integrated-vs-package-based#standalone-applications). Not to be confused with the "Vue Standalone API", a standalone project in Nx is a non-monorepo setup where you have a single application at the root level. This setup is very similar to what the Vue CLI gives you.

What are you going to learn?

- how to create a new standalone (single-project) Nx workspace setup for Vue
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

Note, while you could easily use Nx together with your manually set up Vue application, we're going to use the `@nx/vue` plugin for this tutorial which provides some nice enhancements when working with Vue. [Visit our "Why Nx" page](/getting-started/why-nx) to learn more about plugins and what role they play in the Nx architecture.

## Final Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/vue-standalone" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/vue-standalone?file=README.md" /%} -->

## Creating a new Vue App

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=49" /%} -->

Create a new Vue application with the following command:

```{% command="npx create-nx-workspace@latest myvueapp --preset=vue-standalone" path="~" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Test runner to use for end to end (E2E) tests · cypress
✔ Default stylesheet format · css
✔ Set up CI with caching, distribution and test deflaking · github
```

You can also choose [Playwright](/nx-api/playwright) for your e2e tests or a different stylesheet format. In this tutorial we're going to use Cypress and css. The above command generates the following structure:

```
└─ myvueapp
   ├─ .vscode
   │  └─ extensions.json
   ├─ e2e
   │  ├─ ...
   │  ├─ project.json
   │  ├─ src
   │  │  ├─ e2e
   │  │  │  └─ app.cy.ts
   │  │  ├─ ...
   │  └─ tsconfig.json
   ├─ src
   │  ├─ app
   │  │  ├─ App.spec.ts
   │  │  ├─ App.vue
   │  │  └─ NxWelcome.vue
   │  ├─ main.ts
   │  └─ styles.css
   ├─ index.html
   ├─ nx.json
   ├─ package.json
   ├─ project.json
   ├─ README.md
   ├─ tsconfig.app.json
   ├─ tsconfig.base.json
   ├─ tsconfig.json
   ├─ tsconfig.spec.json
   └─ vite.config.ts
```

The setup includes..

- a new Vue application at the root of the Nx workspace (`src`)
- a Cypress based set of e2e tests (`e2e/`)
- Prettier preconfigured
- ESLint preconfigured
- Vitest preconfigured

Let me explain a couple of things that might be new to you.

| File           | Description                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx.json`      | This is where we fine-tune how Nx works. We define what [cacheable operations](/features/cache-task-results) there are, and configure our [task pipeline](/concepts/task-pipeline-configuration). More on that soon. |
| `project.json` | This file is where you can modify the inferred tasks for the `myvueapp` project. More about this later.                                                                                                              |

## Serving the App

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=296" /%} -->

The most common tasks are already defined in the `package.json` file:

```json {% fileName="package.json" %}
{
  "name": "myvueapp",
  "scripts": {
    "start": "nx serve",
    "build": "nx build",
    "test": "nx test"
  }
  ...
}
```

To serve your new Vue application, just run: `npm start`. Alternatively you can directly use Nx by using

```shell
nx serve
```

Your application should be served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Inferred Tasks

Nx identifies available tasks for your project from [tooling configuration files](/concepts/inferred-tasks), `package.json` scripts and the targets defined in `project.json`. To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

```shell
nx show project myvueapp --web
```

{% project-details title="Project Details View (Simplified)" height="100px" %}

```json
{
  "project": {
    "name": "myvueapp",
    "data": {
      "metadata": {
        "technologies": ["vue"]
      },
      "root": ".",
      "includedScripts": [],
      "name": "myvueapp",
      "targets": {
        "build": {
          "options": {
            "cwd": ".",
            "command": "vite build"
          },
          "cache": true,
          "dependsOn": ["^build"],
          "inputs": [
            "production",
            "^production",
            {
              "externalDependencies": ["vite"]
            }
          ],
          "outputs": ["{projectRoot}/dist/myvueapp"],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["vite"]
          }
        }
      },
      "sourceRoot": "./src",
      "projectType": "application",
      "$schema": "node_modules/nx/schemas/project-schema.json",
      "implicitDependencies": [],
      "tags": []
    }
  },
  "sourceMap": {
    "root": ["project.json", "nx/core/project-json"],
    "includedScripts": ["package.json", "nx/core/package-json-workspaces"],
    "name": ["project.json", "nx/core/project-json"],
    "targets": ["project.json", "nx/core/project-json"],
    "targets.build": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.command": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.cache": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.dependsOn": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.inputs": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.outputs": ["vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options.cwd": ["vite.config.ts", "@nx/vite/plugin"],
    "sourceRoot": ["project.json", "nx/core/project-json"],
    "projectType": ["project.json", "nx/core/project-json"],
    "$schema": ["project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

If you expand the `build` task, you can see that it was created by the `@nx/vite` plugin by analyzing your `vite.config.ts` file. Notice the outputs are defined as `{projectRoot}/dist/myvueapp`. This value is being read from the `build.outDir` defined in your `vite.config.ts` file. Let's change that value in your `vite.config.ts` file:

```ts {% fileName="vite.config.ts" %}
export default defineConfig({
  // ...
  build: {
    outDir: './build/myvueapp',
    // ...
  },
});
```

Now if you look at the project details view, the outputs for the build target will say `{projectRoot}/build/myvueapp`. This feature ensures that Nx will always cache the correct files.

You can also override the settings for inferred tasks by modifying the [`targetDefaults` in `nx.json`](/reference/nx-json#target-defaults) or setting a value in your [`project.json` file](/reference/project-configuration). Nx will merge the values from the inferred tasks with the values you define in `targetDefaults` and in your specific project's configuration.

## Testing and Linting - Running Multiple Tasks

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=369" /%} -->

Our current setup not only has targets for serving and building the Vue application, but also has targets for unit testing, e2e testing and linting. We can use the same syntax as before to run these tasks:

```bash
nx test # runs tests using Jest
nx lint # runs linting with ESLint
nx e2e e2e # runs e2e tests with Cypress
```

More conveniently, we can also run them in parallel using the following syntax:

```{% command="nx run-many -t test lint e2e" path="myvueapp" %}

✔  nx run e2e:lint (1s)
✔  nx run myvueapp:lint (1s)
✔  nx run myvueapp:test (2s)
✔  nx run e2e:e2e (6s)

——————————————————————————————————————————————————————

NX   Successfully ran targets test, lint, e2e for 2 projects (8s)
```

### Caching

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=443" /%} -->

One thing to highlight is that Nx is able to [cache the tasks you run](/features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="nx run-many -t test lint e2e" path="myvueapp" %}

✔  nx run myvueapp:lint  [existing outputs match the cache, left as is]
✔  nx run e2e:lint  [existing outputs match the cache, left as is]
✔  nx run myvueapp:test  [existing outputs match the cache, left as is]
✔  nx run e2e:e2e  [existing outputs match the cache, left as is]

———————————————————————————————————————————————————————

NX   Successfully ran targets test, lint, e2e for 2 projects (143ms)

Nx read the output from the cache instead of running the command for 4 out of 4 tasks.
```

Not all tasks might be cacheable though. You can mark all targets of a certain type as cacheable by setting `cache` to `true` in the `targetDefaults` of the `nx.json` file. You can also [learn more about how caching works](/features/cache-task-results).

## Nx Plugins? Why?

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=598" /%} -->

One thing you might be curious about is the [inferred tasks](/concepts/inferred-tasks). You may wonder why we are detecting tasks from your tooling configuration instead of directly defining them in `package.json` scripts or in the `project.json` file.

Nx understands and supports both approaches, allowing you to define tasks in your `package.json` and `project.json` files or have Nx plugins automatically detect them. The inferred tasks give you the benefit of automatically setting the Nx cache settings for you based on your tooling configuration. In this tutorial, we take advantage of those inferred tasks to demonstrate the full value of Nx plugins.

So, what are Nx Plugins? Nx Plugins are optional packages that extend the capabilities of Nx, catering to various specific technologies. For instance, we have plugins tailored to Vue (e.g., `@nx/vue`), Vite (`@nx/vite`), Cypress (`@nx/cypress`), and more. These plugins offer additional features, making your development experience more efficient and enjoyable when working with specific tech stacks.

[Visit our "Why Nx" page](/getting-started/why-nx) for more details.

## Creating New Components

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=500" /%} -->

You can just create new Vue components as you normally would. However, Nx plugins usually also ship [generators](/features/generate-code). They allow you to easily scaffold code, configuration or entire projects. To see what capabilities the `@nx/vue` plugin ships, run the following command and inspect the output:

```{% command="npx nx list @nx/vue" path="myvueapp" %}

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

More info can be found in [the integrate with editors article](/getting-started/editor-setup).

{% /callout %}

Run the following command to generate a new "hello-world" component. Note how we append `--dry-run` to first check the output.

```{% command="npx nx g @nx/vue:component hello-world --no-export --unit-test-runner=vitest --directory=src/components --dry-run" path="myvueapp" %}
NX  Generating @nx/vue:component

CREATE src/components/hello-world.spec.ts
CREATE src/components/hello-world.vue

NOTE: The "dryRun" flag means no changes were made.
```

As you can see it generates a new component in the `src/components/` folder. If you want to actually run the generator, remove the `--dry-run` flag.

```ts {% fileName="src/components/hello-world.vue" %}
<script setup lang="ts">
// defineProps<{}>();
</script>

<template>
  <p>Welcome to HelloWorld!</p>
</template>

<style scoped></style>
```

## Building the App for Deployment

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=680" /%} -->

If you're ready and want to ship your application, you can build it using

```{% command="npx nx build" path="myvueapp" %}
> nx run myvueapp:build:production

 vite v4.3.9 building for production...
 ✓ 15 modules transformed.
 dist/myvueapp/index.html                  0.43 kB │ gzip:  0.29 kB
 dist/myvueapp/assets/index-a0201bbf.css   7.90 kB │ gzip:  1.78 kB
 dist/myvueapp/assets/index-46a11b5f.js   62.39 kB │ gzip: 24.35 kB
 ✓ built in 502ms

—————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target build for project myvueapp (957ms)
```

All the required files will be placed in the `dist/myvueapp` folder and can be deployed to your favorite hosting provider.

## You're ready to go!

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=723" /%} -->

In the previous sections you learned about the basics of using Nx, running tasks and navigating an Nx workspace. You're ready to ship features now!

But there's more to learn. You have two possibilities here:

- [Jump to the next steps section](#next-steps) to find where to go from here or
- keep reading and learn some more about what makes Nx unique when working with Vue.

## Modularizing your Vue App with Local Libraries

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=750" /%} -->

When you develop your Vue application, usually all your logic sits in the `app` folder. Ideally separated by various folder names which represent your "domains". As your app grows, this becomes more and more monolithic though.

The following structure is a common example of this kind of monolithic code organization:

```
└─ myvueapp
   ├─ ...
   ├─ src
   │  ├─ app
   │  │  ├─ products
   │  │  ├─ cart
   │  │  ├─ ui
   │  │  ├─ ...
   │  │  └─ App.vue
   │  ├─ ...
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

### Creating Local Libraries

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=818" /%} -->

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for each of these areas using the Vue library generator:

```
nx g @nx/vue:library products --directory=modules/products --unit-test-runner=vitest --bundler=vite
nx g @nx/vue:library orders --directory=modules/orders --unit-test-runner=vitest --bundler=vite
nx g @nx/vue:library shared-ui --directory=modules/shared/ui --unit-test-runner=vitest --bundler=vite
```

Note how we use the `--directory` flag to place the libraries into a subfolder. You can choose whatever folder structure you like, even keep all of them at the root-level.

Running the above commands should lead to the following directory structure:

```
└─ myvueapp
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
   │  │  │  ├─ components
   │  │  │  │  ├─ products.spec.ts
   │  │  │  │  └─ products.vue
   │  │  │  └─ vue-shims.d.ts
   │  │  ├─ tsconfig.json
   │  │  ├─ tsconfig.lib.json
   │  │  └─ tsconfig.spec.json
   │  ├─ orders
   │  │  ├─ ...
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  ├─ components
   │  │  │  │  ├─ ...
   │  │  │  │  └─ orders.vue
   │  │  ├─ ...
   │  └─ shared
   │     └─ ui
   │        ├─ ...
   │        ├─ src
   │        │  ├─ index.ts
   │        │  └─ components
   │        │     └─ shared-ui.vue
   │        └─ ...
   ├─ ...
   ├─ src
   │  ├─ app
   │  │  ├─ ...
   │  │  ├─ App.vue
   │  ├─ ...
   ├─ ...
```

Each of these libraries

- has a project details view where you can see the available tasks (e.g. running tests for just orders: `nx test orders`)
- has its own `project.json` file where you can customize targets
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the Vue Application

<!-- {% video-link link="https://youtu.be/ZAO0yXupIIE?t=976" /%} -->

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@myvueapp/orders": ["modules/orders/src/index.ts"],
      "@myvueapp/products": ["modules/products/src/index.ts"],
      "@myvueapp/shared-ui": ["modules/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our Vue application. As an example, let's create and expose a `ProductList` component from our `modules/products` library. Either create it by hand or run

```shell
nx g @nx/vue:component product-list --directory=modules/products/src/product-list
```

We don't need to implement anything fancy as we just want to learn how to import it into our main Vue application.

```tsx {% fileName="modules/products/src/product-list/product-list.vue" %}
<script setup lang="ts">
// defineProps<{}>()
</script>

<template>
  <p>Welcome to ProductList!</p>
</template>

<style scoped></style>
```

Make sure the `ProductList` is exported via the `index.ts` file of our `products` library. This is our public API with the rest of the workspace. Only export what's really necessary to be usable outside the library itself.

```ts {% fileName="modules/products/src/index.ts" %}
export { default as ProductList } from './product-list/product-list.vue';
```

We're ready to import it into our main application now. First, let's set up the Vue Router.

```shell
npm add vue-router
```

Configure it in the `main.ts` file.

```ts {% fileName="src/main.ts" %}
import './styles.css';

import { createApp } from 'vue';
import App from './app/App.vue';
import NxWelcome from './app/NxWelcome.vue';
import * as VueRouter from 'vue-router';

const routes = [
  { path: '/', component: NxWelcome },
  {
    path: '/products',
    component: () => import('@myvueapp/products').then((m) => m.ProductList),
  },
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes,
});

const app = createApp(App);

app.use(router);
app.mount('#root');
```

Then we can set up navigation links and the `RouterView` in the main `App` component.

```vue {% fileName="src/app/App.vue" %}
<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <nav>
    <ul>
      <li>
        <RouterLink to="/">Home</RouterLink>
      </li>
      <li>
        <RouterLink to="/products">Products</RouterLink>
      </li>
    </ul>
  </nav>

  <RouterView />
</template>
```

If you now navigate to [http://localhost:4200/#/products](http://localhost:4200/#/products) you should see the `ProductList` component being rendered.

![Browser screenshot of navigating to the products route](/shared/images/tutorial-vue-standalone/vue-tutorial-products-route.png)

Let's do the same process for our `orders` library. Create an `OrderList` component and import it into the `main.ts` routes:

```ts {% fileName="src/main.ts" %}
import './styles.css';

import { createApp } from 'vue';
import App from './app/App.vue';
import NxWelcome from './app/NxWelcome.vue';
import * as VueRouter from 'vue-router';

const routes = [
  { path: '/', component: NxWelcome },
  {
    path: '/products',
    component: () => import('@myvueapp/products').then((m) => m.ProductList),
  },
  {
    path: '/orders',
    component: () => import('@myvueapp/orders').then((m) => m.OrderList),
  },
];

const router = VueRouter.createRouter({
  history: VueRouter.createWebHashHistory(),
  routes,
});

const app = createApp(App);

app.use(router);
app.mount('#root');
```

And update the navigation links:

```vue {% fileName="src/app/App.vue" %}
<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <nav>
    <ul>
      <li>
        <RouterLink to="/">Home</RouterLink>
      </li>
      <li>
        <RouterLink to="/products">Products</RouterLink>
      </li>
      <li>
        <RouterLink to="/orders">Orders</RouterLink>
      </li>
    </ul>
  </nav>

  <RouterView />
</template>
```

Similarly, navigating to [http://localhost:4200/#/orders](http://localhost:4200/#/orders) should now render the `Orders` component.

Note that both the `Products` component and `Orders` component are lazy loaded so the initial bundle size will be smaller.

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
      "name": "myvueapp",
      "type": "app",
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
      "name": "shared-ui",
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
    "myvueapp": [
      { "source": "myvueapp", "target": "orders" },
      { "source": "myvueapp", "target": "products" }
    ],
    "e2e": [{ "source": "e2e", "target": "myvueapp", "type": "implicit" }],
    "shared-ui": [],
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

Notice how `shared-ui` is not yet connected to anything because we didn't import it in any of our projects. Also the arrows to `orders` and `products` are dashed because we're using lazy imports.

Exercise for you: change the codebase so that `shared-ui` is used by `orders` and `products`. Note: you need to restart the `nx graph` command to update the graph visualization or run the CLI command with the `--watch` flag.

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

To enforce the rules, Nx ships with a custom ESLint rule. Open the `.eslintrc.base.json` at the root of the workspace and add the following `depConstraints` in the `@nx/enforce-module-boundaries` rule configuration:

```json {% fileName=".eslintrc.base.json" %}
{
  ...
  "overrides": [
    {
      ...
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
    },
    ...
  ]
}
```

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
NX   Running target lint for 5 projects
✖  nx run products:lint
   Linting "products"...

   /Users/isaac/Documents/code/nx-recipes/vue-standalone/modules/products/src/lib/products.vue
     5:1   error    A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries
     5:10  warning  'Orders' is defined but never used                                                                           @typescript-eslint/no-unused-vars

   ✖ 2 problems (1 error, 1 warning)

   Lint warnings found in the listed files.

   Lint errors found in the listed files.


✔  nx run orders:lint (913ms)
✔  nx run e2e:lint  [existing outputs match the cache, left as is]
✔  nx run myvueapp:lint (870ms)
✔  nx run shared-ui:lint (688ms)

——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Ran target lint for 5 projects (2s)

✔    4/5 succeeded [1 read from cache]

✖    1/5 targets failed, including the following:
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
