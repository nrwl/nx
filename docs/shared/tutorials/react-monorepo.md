---
title: 'React Monorepo Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building React Apps in an Nx Monorepo

In this tutorial you'll learn how to use React with Nx in a [monorepo (integrated) setup](/concepts/integrated-vs-package-based#integrated-repos).

What are you going to learn?

- how to create a new React application
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

{% callout type="info" title="Looking for a React standalone app?" %}
Note, this tutorial sets up a repo with applications and libraries in their own subfolders. If you are looking for a React standalone app setup then check out our [React standalone app tutorial](/getting-started/tutorials/react-standalone-tutorial).
{% /callout %}

## Why Use an Integrated Monorepo?

An integrated monorepo is a repository configured with a set of features that work together toward the goal of allowing developers to focus on building features rather than the configuration, coordination and maintenance of the tooling in the repo.

You'll notice that instead of using npm/yarn/pnpm workspaces, projects within the repository are linked using typescript path aliases that are defined in the `tsconfig.base.json` file. Also, since we're creating projects using Nx plugin generators, all new projects come preconfigured with useful tools like Prettier, ESLint and Jest.

Nx Plugins are optional packages that extend the capabilities of Nx, catering to various specific technologies. For instance, we have plugins tailored to React (e.g., `@nx/react`), Vite (`@nx/vite`), Cypress (`@nx/cypress`), and more. These plugins offer additional features, making your development experience more efficient and enjoyable when working with specific tech stacks.

Features of an integrated monorepo:

- [Install dependencies at the root by default](/concepts/decisions/dependency-management#single-version-policy)
- [Scaffold new code with generators](/features/generate-code)
- [Updates dependencies with automated migrations](/features/automate-updating-dependencies)

Visit our ["Why Nx" page](/getting-started/why-nx) for more details.

## Final Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/react-monorepo" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/react-standalone?file=README.md" /%} -->

<!-- {% youtube
src="https://www.youtube.com/embed/OQ-Zc5tcxJE"
title="Tutorial: Standalone React Application"
/%} -->

## Creating a new React Monorepo

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=64" /%} -->

Create a new React monorepo with the following command:

```{% command="npx create-nx-workspace@latest react-monorepo --preset=react-monorepo" path="~" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Application name · react-store
✔ Which bundler would you like to use? · vite
✔ Test runner to use for end to end (E2E) tests · cypress
✔ Default stylesheet format · css
✔ Do you want Nx Cloud to make your CI fast? · Yes
```

Let's name the initial application `react-store`. In this tutorial we're going to use `vite` as a bundler, `cypress` for e2e tests and `css` for styling. The above command generates the following structure:

```
└─ react-monorepo
   ├─ ...
   ├─ apps
   │  ├─ react-store
   │  │  ├─ public
   │  │  │  └─ ...
   │  │  ├─ src
   │  │  │  ├─ app
   │  │  │  │  ├─ app.module.css
   │  │  │  │  ├─ app.spec.tsx
   │  │  │  │  ├─ app.tsx
   │  │  │  │  └─ nx-welcome.tsx
   │  │  │  ├─ assets
   │  │  │  ├─ main.tsx
   │  │  │  └─ styles.css
   │  │  ├─ index.html
   │  │  ├─ project.json
   │  │  ├─ tsconfig.app.json
   │  │  ├─ tsconfig.json
   │  │  ├─ tsconfig.spec.json
   │  │  └─ vite.config.ts
   │  └─ react-store-e2e
   │     └─ ...
   ├─ nx.json
   ├─ tsconfig.base.json
   └─ package.json
```

The setup includes..

- a new React application (`apps/react-store/`)
- a Cypress based set of e2e tests (`apps/react-store-e2e/`)
- Prettier preconfigured
- ESLint preconfigured
- Jest preconfigured

Typically, an integrated Nx workspace places application projects in the `apps` folder and library projects in the `libs` folder. Applications are encouraged to be as light-weight as possible so that more code is pushed into libraries and can be reused in other projects. This folder structure is just a suggestion and can be modified to suit your organization's needs.

The [`nx.json` file](/reference/nx-json) contains configuration settings for Nx itself and global default settings that individual projects inherit. The `apps/react-store/project.json` file contains [settings that are specific to the `react-store` project](/reference/project-configuration). We'll examine that file more in the next section.

## Serving the App

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=207" /%} -->

To serve your new React application, just run:

```shell
nx serve react-store
```

Your application should be served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Inferred Tasks

Nx identifies available tasks for your project from [tooling configuration files](/concepts/inferred-tasks), `package.json` scripts and the targets defined in `project.json`. To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

```shell
nx show project react-store --web
```

{% project-details title="Project Details View (Simplified)" height="100px" %}

```json
{
  "project": {
    "name": "react-store",
    "data": {
      "metadata": {
        "technologies": ["react"]
      },
      "root": "apps/react-store",
      "includedScripts": [],
      "name": "react-store",
      "targets": {
        "build": {
          "options": {
            "cwd": "apps/react-store",
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
          "outputs": ["{workspaceRoot}/dist/apps/react-store"],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["vite"]
          }
        }
      },
      "sourceRoot": "apps/react-store/src",
      "projectType": "application",
      "$schema": "node_modules/nx/schemas/project-schema.json",
      "tags": [],
      "implicitDependencies": []
    }
  },
  "sourceMap": {
    "root": ["apps/react-store/project.json", "nx/core/project-json"],
    "targets": ["apps/react-store/project.json", "nx/core/project-json"],
    "targets.build": ["apps/react-store/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.command": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.options": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.cache": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.dependsOn": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.inputs": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.outputs": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "targets.build.options.cwd": [
      "apps/react-store/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "name": ["apps/react-store/project.json", "nx/core/project-json"],
    "$schema": ["apps/react-store/project.json", "nx/core/project-json"],
    "sourceRoot": ["apps/react-store/project.json", "nx/core/project-json"],
    "projectType": ["apps/react-store/project.json", "nx/core/project-json"],
    "tags": ["apps/react-store/project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

If you expand the `build` task, you can see that it was created by the `@nx/vite` plugin by analyzing your `vite.config.ts` file. Notice the outputs are defined as `{workspaceRoot}/dist/apps/react-store`. This value is being read from the `build.outDir` defined in your `vite.config.ts` file. Let's change that value in your `vite.config.ts` file:

```ts {% fileName="apps/react-store/vite.config.ts" %}
export default defineConfig({
  // ...
  build: {
    outDir: './build/react-store',
    // ...
  },
});
```

Now if you look at the project details view, the outputs for the build target will say `{workspaceRoot}/build/react-store`. This feature ensures that Nx will always cache the correct files.

You can also override the settings for inferred tasks by modifying the [`targetDefaults` in `nx.json`](/reference/nx-json#target-defaults) or setting a value in your [`project.json` file](/reference/project-configuration). Nx will merge the values from the inferred tasks with the values you define in `targetDefaults` and in your specific project's configuration.

## Adding Another Application

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=706" /%} -->

Nx plugins usually provide [generators](/features/generate-code) that allow you to easily scaffold code, configuration or entire projects. To see what capabilities the `@nx/react` plugin provides, run the following command and inspect the output:

```{% command="npx nx list @nx/react" path="react-monorepo" %}

NX   Capabilities in @nx/react:

   GENERATORS

   init : Initialize the `@nrwl/react` plugin.
   application : Create a React application.
   library : Create a React library.
   component : Create a React component.
   redux : Create a Redux slice for a project.
   storybook-configuration : Set up storybook for a React app or library.
   component-story : Generate storybook story for a React component
   stories : Create stories/specs for all components declared in an app or library.
   component-cypress-spec : Create a Cypress spec for a UI component that has a story.
   hook : Create a hook.
   cypress-component-configuration : Setup Cypress component testing for a React project
   component-test : Generate a Cypress component test for a React component
   setup-tailwind : Set up Tailwind configuration for a project.
   setup-ssr : Set up SSR configuration for a project.
   host : Generate a host react application
   remote : Generate a remote react application
   federate-module : Federate a module.

   EXECUTORS/BUILDERS

   module-federation-dev-server : Serve a host or remote application.
   module-federation-ssr-dev-server : Serve a host application along with it's known remotes.
```

{% callout type="info" title="Prefer a more visual UI?" %}

If you prefer a more integrated experience, you can install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the integrate with editors article](/getting-started/editor-setup).

{% /callout %}

Run the following command to generate a new `inventory` application. Note how we append `--dry-run` to first check the output.

```{% command="npx nx g @nx/react:app inventory --directory=apps/inventory --dry-run" path="react-monorepo" %}
NX  Generating @nx/react:application

✔ Would you like to add React Router to this application? (y/N) · false
✔ Which E2E test runner would you like to use? · cypress
✔ What should be the project name and where should it be generated? · inventory @ apps/inventory
CREATE apps/inventory/index.html
CREATE apps/inventory/public/favicon.ico
CREATE apps/inventory/src/app/app.spec.tsx
CREATE apps/inventory/src/assets/.gitkeep
CREATE apps/inventory/src/main.tsx
CREATE apps/inventory/tsconfig.app.json
CREATE apps/inventory/src/app/nx-welcome.tsx
CREATE apps/inventory/src/app/app.module.css
CREATE apps/inventory/src/app/app.tsx
CREATE apps/inventory/src/styles.css
CREATE apps/inventory/tsconfig.json
CREATE apps/inventory/project.json
CREATE apps/inventory/tsconfig.spec.json
CREATE apps/inventory/vite.config.ts
CREATE apps/inventory/.eslintrc.json
CREATE apps/inventory-e2e/project.json
CREATE apps/inventory-e2e/src/e2e/app.cy.ts
CREATE apps/inventory-e2e/src/support/app.po.ts
CREATE apps/inventory-e2e/src/support/e2e.ts
CREATE apps/inventory-e2e/src/fixtures/example.json
CREATE apps/inventory-e2e/src/support/commands.ts
CREATE apps/inventory-e2e/cypress.config.ts
CREATE apps/inventory-e2e/tsconfig.json
CREATE apps/inventory-e2e/.eslintrc.json

NOTE: The "dryRun" flag means no changes were made.
```

As you can see, it generates a new application in the `apps/inventory/` folder. Let's actually run the generator by removing the `--dry-run` flag.

```shell
npx nx g @nx/react:app inventory --directory=apps/inventory
```

## Sharing Code with Local Libraries

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=986" /%} -->

When you develop your React application, usually all your logic sits in the `app` folder. Ideally separated by various folder names which represent your "domains". As your app grows, however, the app becomes more and more monolithic and the code is unable to be shared with other applications.

```
└─ react-monorepo
   ├─ ...
   ├─ apps
   │  └─ react-store
   │     ├─ ...
   │     ├─ src
   │     │  ├─ app
   │     │  │  ├─ products
   │     │  │  ├─ cart
   │     │  │  ├─ ui
   │     │  │  ├─ ...
   │     │  │  └─ app.tsx
   │     │  ├─ ...
   │     │  └─ main.tsx
   │     ├─ ...
   │     └─ project.json
   ├─ nx.json
   ├─ ...
```

Nx allows you to separate this logic into "local libraries". The main benefits include

- better separation of concerns
- better reusability
- more explicit "APIs" between your "domain areas"
- better scalability in CI by enabling independent test/lint/build commands for each library
- better scalability in your teams by allowing different teams to work on separate libraries

### Creating Local Libraries

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1041" /%} -->

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for each of these areas using the React library generator:

```
nx g @nx/react:library products --directory=libs/products --unitTestRunner=vitest --bundler=none
nx g @nx/react:library orders --directory=libs/orders --unitTestRunner=vitest --bundler=none
nx g @nx/react:library shared-ui --directory=libs/shared/ui --unitTestRunner=vitest --bundler=none
```

Note how we type out the full path in the `directory` flag to place the libraries into a subfolder. You can choose whatever folder structure you like to organize your projects. If you change your mind later, you can run the [move generator](/nx-api/workspace/generators/move) to move a project to a different folder.

Running the above commands should lead to the following directory structure:

```
└─ react-monorepo
   ├─ ...
   ├─ apps
   ├─ libs
   │  ├─ products
   │  │  ├─ ...
   │  │  ├─ project.json
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  └─ lib
   │  │  │     ├─ products.spec.ts
   │  │  │     └─ products.ts
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
   ├─ ...
```

Each of these libraries

- has a project details view where you can see the available tasks (e.g. running tests for just orders: `nx test orders`)
- has its own `project.json` file where you can customize targets
- has the name you specified in the generate command; you can find the name in the corresponding `project.json` file
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the React Applications

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1245" /%} -->

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@react-monorepo/products": ["libs/products/src/index.ts"],
      "@react-monorepo/orders": ["libs/orders/src/index.ts"],
      "@react-monorepo/shared-ui": ["libs/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our React application. As an example, let's create and expose a `ProductList` component from our `libs/products` library. Either create it by hand or run

```shell
nx g @nx/react:component product-list --project=products --directory="libs/products/src/lib/product-list"
```

We don't need to implement anything fancy as we just want to learn how to import it into our main React application.

```tsx {% fileName="libs/products/src/lib/product-list/product-list.tsx" %}
import styles from './product-list.module.css';

/* eslint-disable-next-line */
export interface ProductListProps {}

export function ProductList(props: ProductListProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to ProductList!</h1>
    </div>
  );
}

export default ProductList;
```

Make sure the `ProductList` is exported via the `index.ts` file of our `products` library. This is our public API with the rest of the workspace. Only export what's really necessary to be usable outside the library itself.

```ts {% fileName="libs/products/src/index.ts" %}
export * from './lib/product-list/product-list';
```

We're ready to import it into our main application now. First (if you haven't already), let's set up React Router.

{% tabs %}
{% tab label="npm" %}

```shell
npm add react-router-dom
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add react-router-dom
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm add react-router-dom
```

{% /tab %}
{% /tabs %}

Configure it in the `main.tsx`.

```tsx {% fileName="apps/react-store/src/main.tsx" %}
import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import ReactDOM from 'react-dom/client';

import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
```

Then we can import the `ProductList` component into our `app.tsx` and render it via the routing mechanism whenever a user hits the `/products` route.

```tsx {% fileName="apps/react-store/src/app/app.tsx" %}
import { Route, Routes } from 'react-router-dom';

// importing the component from the library
import { ProductList } from '@react-monorepo/products';

function Home() {
  return <h1>Home</h1>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />}></Route>
      <Route path="/products" element={<ProductList />}></Route>
    </Routes>
  );
}

export default App;
```

Serving your app (`nx serve react-store`) and then navigating to `/products` should give you the following result:

![products route](/shared/images/tutorial-react-standalone/react-tutorial-products-route.png)

Let's apply the same for our `orders` library.

- generate a new component `OrderList` in `libs/orders` and export it in the corresponding `index.ts` file
- import it into the `app.tsx` and render it via the routing mechanism whenever a user hits the `/orders` route

In the end, your `app.tsx` should look similar to this:

```tsx {% fileName="apps/react-store/src/app/app.tsx" %}
import { Route, Routes } from 'react-router-dom';
import { ProductList } from '@react-monorepo/products';
import { OrderList } from '@react-monorepo/orders';

function Home() {
  return <h1>Home</h1>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />}></Route>
      <Route path="/products" element={<ProductList />}></Route>
      <Route path="/orders" element={<OrderList />}></Route>
    </Routes>
  );
}

export default App;
```

Let's also show products in the `inventory` app.

```tsx {% fileName="apps/inventory/src/app/app.tsx" %}
import { ProductList } from '@react-monorepo/products';

export function App() {
  return <ProductList />;
}

export default App;
```

## Visualizing your Project Structure

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1416" /%} -->

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `nx build`, identifying [affected projects](/features/run-tasks#run-tasks-on-projects-affected-by-a-pr) and more. Interestingly you can also visualize it.

Just run:

```shell
nx graph
```

You should be able to see something similar to the following in your browser.

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "react-store",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "react-store-e2e",
      "type": "e2e",
      "data": {
        "tags": []
      }
    },
    {
      "name": "inventory",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "inventory-e2e",
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
    "react-store": [
      { "source": "react-store", "target": "orders", "type": "static" },
      { "source": "react-store", "target": "products", "type": "static" }
    ],
    "react-store-e2e": [
      {
        "source": "react-store-e2e",
        "target": "react-store",
        "type": "implicit"
      }
    ],
    "inventory": [
      { "source": "inventory", "target": "products", "type": "static" }
    ],
    "inventory-e2e": [
      { "source": "inventory-e2e", "target": "inventory", "type": "implicit" }
    ],
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

Notice how `shared-ui` is not yet connected to anything because we didn't import it in any of our projects.

Exercise for you: change the codebase such that `shared-ui` is used by `orders` and `products`. Note: you need to restart the `nx graph` command to update the graph visualization or run the CLI command with the `--watch` flag.

## Testing and Linting - Running Multiple Tasks

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=410" /%} -->

Our current setup doesn't just come with targets for serving and building the React application, but also has targets for unit testing, e2e testing and linting. Again, these are defined in the `project.json` file. We can use the same syntax as before to run these tasks:

```bash
nx test react-store # runs the tests for react-store
nx lint inventory # runs the linter on inventory
nx e2e react-store-e2e # runs e2e tests for the react-store
```

More conveniently, we can also run tasks in parallel using the following syntax:

```shell
nx run-many -t test
```

### Caching

One thing to highlight is that Nx is able to [cache the tasks you run](/features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="nx run-many -t test lint e2e" path="react-monorepo" %}
✔  nx run e2e:lint  [existing outputs match the cache, left as is]
✔  nx run react-store:lint  [existing outputs match the cache, left as is]
✔  nx run react-store:test  [existing outputs match the cache, left as is]
✔  nx run e2e:e2e  [existing outputs match the cache, left as is]

——————————————————————————————————————————————————————

NX   Successfully ran targets test, lint, e2e for 5 projects (54ms)

Nx read the output from the cache instead of running the command for 10 out of 10 tasks.
```

Not all tasks might be cacheable though. You can configure the `cache` settings in the `targetDefaults` property of the `nx.json` file. You can also [learn more about how caching works](/features/cache-task-results).

### Testing Affected Projects

Commit your changes to git.

```shell
git commit -a -m "some commit message"
```

And then make a small change to the `products` library.

```tsx {% fileName="libs/products/src/lib/product-list/product-list.tsx" %}
import styles from './product-list.module.css';

/* eslint-disable-next-line */
export interface ProductListProps {}

export function ProductList(props: ProductListProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to ProductList!</h1>
      <p>This is a change. 👋</p>
    </div>
  );
}

export default ProductList;
```

One of the key features of Nx in a monorepo setting is that you're able to run tasks only for projects that are actually affected by the code changes that you've made. To run the tests for only the projects affected by this change, run:

```shell
nx affected -t test
```

Note that the unit tests were run for `products`, `react-store` and `inventory`, but not for `orders` because a change to `products` can not possibly break the tests for `orders`. In a small repo like this, there isn't a lot of time saved, but as there are more tests and more projects, this quickly becomes an essential command.

You can also see what projects are affected in the graph visualizer with;

```shell
nx graph --affected
```

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "react-store",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "react-store-e2e",
      "type": "e2e",
      "data": {
        "tags": []
      }
    },
    {
      "name": "inventory",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "inventory-e2e",
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
    "react-store": [
      { "source": "react-store", "target": "orders", "type": "static" },
      { "source": "react-store", "target": "products", "type": "static" }
    ],
    "react-store-e2e": [
      {
        "source": "react-store-e2e",
        "target": "react-store",
        "type": "implicit"
      }
    ],
    "inventory": [
      { "source": "inventory", "target": "products", "type": "static" }
    ],
    "inventory-e2e": [
      { "source": "inventory-e2e", "target": "inventory", "type": "implicit" }
    ],
    "shared-ui": [],
    "orders": [],
    "products": []
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [
    "products",
    "inventory",
    "inventory-e2e",
    "react-store",
    "react-store-e2e"
  ],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

## Building the Apps for Deployment

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=856" /%} -->

If you're ready and want to ship your applications, you can build them using

```{% command="npx nx run-many -t build" path="react-monorepo" %}
vite v4.3.5 building for production...
✓ 33 libs transformed.
dist/react-store/index.html                   0.48 kB │ gzip:  0.30 kB
dist/react-store/assets/index-e3b0c442.css    0.00 kB │ gzip:  0.02 kB
dist/react-store/assets/index-378e8124.js   165.64 kB │ gzip: 51.63 kB
✓ built in 496ms

——————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target build for project reactutorial (1s)
```

All the required files will be placed in `dist/react-store` and `dist/inventory` and can be deployed to your favorite hosting provider.

You can even create your own `deploy` task that sends the build output to your hosting provider.

```json {% fileName="apps/react-store/project.json" %}
{
  "targets": {
    "deploy": {
      "dependsOn": ["build"],
      "command": "netlify deploy --dir=dist/react-store"
    }
  }
}
```

Replace the `command` with whatever terminal command you use to deploy your site.

The `"dependsOn": ["build"]` setting tells Nx to make sure that the project's `build` task has been run successfully before the `deploy` task.

With the `deploy` tasks defined, you can deploy a single application with `nx deploy react-store` or deploy any applications affected by the current changes with:

```shell
nx affected -t deploy
```

## Imposing Constraints with Module Boundary Rules

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1456" /%} -->

Once you modularize your codebase you want to make sure that the libs are not coupled to each other in an uncontrolled way. Here are some examples of how we might want to guard our small demo workspace:

- we might want to allow `orders` to import from `shared-ui` but not the other way around
- we might want to allow `orders` to import from `products` but not the other way around
- we might want to allow all libraries to import the `shared-ui` components, but not the other way around

When building these kinds of constraints you usually have two dimensions:

- **type of project:** what is the type of your library. Example: "feature" library, "utility" library, "data-access" library, "ui" library
- **scope (domain) of the project:** what domain area is covered by the project. Example: "orders", "products", "shared" ... this really depends on the type of product you're developing

Nx comes with a generic mechanism that allows you to assign "tags" to projects. "tags" are arbitrary strings you can assign to a project that can be used later when defining boundaries between projects. For example, go to the `project.json` of your `orders` library and assign the tags `type:feature` and `scope:orders` to it.

```json {% fileName="libs/orders/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:orders"]
}
```

Then go to the `project.json` of your `products` library and assign the tags `type:feature` and `scope:products` to it.

```json {% fileName="libs/products/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:products"]
}
```

Finally, go to the `project.json` of the `shared-ui` library and assign the tags `type:ui` and `scope:shared` to it.

```json {% fileName="libs/shared/ui/project.json" %}
{
  ...
  "tags": ["type:ui", "scope:shared"]
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

To test it, go to your `libs/products/src/lib/product-list/product-list.tsx` file and import the `OrderList` from the `orders` project:

```tsx {% fileName="libs/products/src/lib/product-list/product-list.tsx" %}
import styles from './product-list.module.css';

// This import is not allowed 👇
import { OrderList } from '@react-monorepo/orders';

/* eslint-disable-next-line */
export interface ProductListProps {}

export function ProductList(props: ProductListProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to ProductList!</h1>
      <OrderList />
    </div>
  );
}

export default ProductList;
```

If you lint your workspace you'll get an error now:

```{% command="nx run-many -t lint" %}
 Running target lint for 7 projects
✖  nx run products:lint
   Linting "products"...

   /Users/isaac/Documents/code/nx-recipes/react-monorepo/libs/products/src/lib/product-list/product-list.tsx
     4:1   error    A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries
     4:10  warning  'OrderList' is defined but never used                                                                        @typescript-eslint/no-unused-vars

   ✖ 2 problems (1 error, 1 warning)

   Lint warnings found in the listed files.

   Lint errors found in the listed files.


✔  nx run orders:lint (996ms)
✔  nx run react-store:lint (1s)
✔  nx run react-store-e2e:lint (581ms)
✔  nx run inventory-e2e:lint (588ms)
✔  nx run inventory:lint (836ms)
✔  nx run shared-ui:lint (753ms)

————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Ran target lint for 7 projects (2s)

✔    6/7 succeeded [0 read from cache]

✖    1/7 targets failed, including the following:
     - nx run products:lint
```

If you have the ESLint plugin installed in your IDE you should immediately see an error:

![ESLint module boundary error](/shared/images/tutorial-react-standalone/react-standalone-module-boundaries.png)

Learn more about how to [enforce module boundaries](/features/enforce-module-boundaries).

## Set Up CI for Your React Monorepo

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

Here's some things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn how to [migrate your React app to Nx](/recipes/adopting-nx/adding-to-existing-project)
- [Learn how to setup Tailwind](/recipes/react/using-tailwind-css-in-react)
- [Setup Storybook for our shared UI library](/recipes/storybook/overview-react)

Also, make sure you

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
