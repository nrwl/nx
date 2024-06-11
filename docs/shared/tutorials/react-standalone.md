---
title: 'React Standalone Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building React Apps with the Nx Standalone Setup

In this tutorial you'll learn how to use React with Nx in a ["standalone" (non-monorepo) setup](/concepts/integrated-vs-package-based#standalone-applications).

What are you going to learn?

- how to create a new React application
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

{% callout type="info" title="Looking for React monorepos?" %}
Note, this tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for a React monorepo setup then check out our [React monorepo tutorial](/getting-started/tutorials/react-monorepo-tutorial).

{% /callout %}

Note, while you could easily use Nx together with your manually set up React application, we're going to use the `@nx/react` plugin for this tutorial which provides some nice enhancements when working with React. [Visit our "Why Nx" page](/getting-started/why-nx) to learn more about plugins and what role they play in the Nx architecture.

## Final Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/react-standalone" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/react-standalone?file=README.md" /%} -->

## Creating a new React App

Create a new standalone React application with the following command:

```{% command="npx create-nx-workspace@latest myreactapp --preset=react-standalone" path="~" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Which bundler would you like to use? · vite
✔ Test runner to use for end to end (E2E) tests · cypress
✔ Default stylesheet format · css
✔ Set up CI with caching, distribution and test deflaking · github
```

You can choose any bundler you like. In this tutorial we're going to use Vite. The above command generates the following structure:

```
└─ myreactapp
   ├─ ...
   ├─ e2e
   │  └─ ...
   ├─ public
   │  └─ ...
   ├─ src
   │  ├─ app
   │  │  ├─ app.module.css
   │  │  ├─ app.spec.tsx
   │  │  ├─ app.tsx
   │  │  └─ nx-welcome.tsx
   │  ├─ assets
   │  ├─ main.tsx
   │  └─ styles.css
   ├─ index.html
   ├─ nx.json
   ├─ package.json
   ├─ project.json
   ├─ tsconfig.app.json
   ├─ tsconfig.json
   ├─ tsconfig.spec.json
   └─ vite.config.ts
```

The setup includes..

- a new React application at the root of the Nx workspace (`src/app`)
- a Cypress based set of e2e tests (`e2e/`)
- Prettier preconfigured
- ESLint preconfigured
- Jest preconfigured

Let me explain a couple of things that might be new to you.

| File           | Description                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx.json`      | This is where we fine-tune how Nx works. We define what [cacheable operations](/features/cache-task-results) there are, and configure our [task pipeline](/concepts/task-pipeline-configuration). More on that soon. |
| `project.json` | This file is where you can modify the inferred tasks for the `myreactapp` project. More about this later.                                                                                                            |

## Serving the App

The most common tasks are already mapped in the `package.json` file:

```json {% fileName="package.json" %}
{
  "name": "myreactapp",
  "scripts": {
    "start": "nx serve",
    "build": "nx build",
    "test": "nx test"
  }
  ...
}
```

To serve your new React application, just run: `npm start`. Alternatively you can directly use Nx by using

```shell
nx serve
```

Your application should be served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Inferred Tasks

Nx identifies available tasks for your project from [tooling configuration files](/concepts/inferred-tasks), `package.json` scripts and the targets defined in `project.json`. To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

```shell
nx show project myreactapp --web
```

{% project-details title="Project Details View (Simplified)" height="100px" %}

```json
{
  "project": {
    "name": "myreactapp",
    "data": {
      "metadata": {
        "technologies": ["react"]
      },
      "root": ".",
      "includedScripts": [],
      "name": "myreactapp",
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
          "outputs": ["{projectRoot}/dist/myreactapp"],
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
      "tags": [],
      "implicitDependencies": []
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
    "$schema": ["project.json", "nx/core/project-json"],
    "tags": ["project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

If you expand the `build` task, you can see that it was created by the `@nx/vite` plugin by analyzing your `vite.config.ts` file. Notice the outputs are defined as `{projectRoot}/dist/myreactapp`. This value is being read from the `build.outDir` defined in your `vite.config.ts` file. Let's change that value in your `vite.config.ts` file:

```ts {% fileName="vite.config.ts" %}
export default defineConfig({
  // ...
  build: {
    outDir: './build/myreactapp',
    // ...
  },
});
```

Now if you look at the project details view, the outputs for the build target will say `{projectRoot}/build/myreactapp`. This feature ensures that Nx will always cache the correct files.

You can also override the settings for inferred tasks by modifying the [`targetDefaults` in `nx.json`](/reference/nx-json#target-defaults) or setting a value in your [`project.json` file](/reference/project-configuration). Nx will merge the values from the inferred tasks with the values you define in `targetDefaults` and in your specific project's configuration.

## Testing and Linting - Running Multiple Tasks

Our current setup doesn't just come with targets for serving and building the React application, but also has targets for unit testing, e2e testing and linting. We can use the same syntax as before to run these tasks:

```bash
nx test # runs tests using Vitest (or you can configure it to use Jest)
nx lint # runs linting with ESLint
nx e2e e2e # runs e2e tests with Cypress
```

More conveniently, we can also run them in parallel using the following syntax:

```{% command="nx run-many -t test lint e2e" path="myreactapp" %}

✔  nx run e2e:lint (2s)
✔  nx run myreactapp:lint (2s)
✔  nx run myreactapp:test (2s)
✔  nx run e2e:e2e (6s)

——————————————————————————————————————————————————————

NX   Successfully ran targets test, lint, e2e for 2 projects (7s)
```

### Caching

One thing to highlight is that Nx is able to [cache the tasks you run](/features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="nx run-many -t test lint e2e" path="myreactapp" %}

✔  nx run e2e:lint  [existing outputs match the cache, left as is]
✔  nx run myreactapp:lint  [existing outputs match the cache, left as is]
✔  nx run myreactapp:test  [existing outputs match the cache, left as is]
✔  nx run e2e:e2e  [existing outputs match the cache, left as is]

——————————————————————————————————————————————————————

NX   Successfully ran targets test, lint, e2e for 5 projects (54ms)

Nx read the output from the cache instead of running the command for 10 out of 10 tasks.
```

Not all tasks might be cacheable though. You can configure the `cache` properties in the targets under `targetDefaults` in the `nx.json` file. You can also [learn more about how caching works](/features/cache-task-results).

## Nx Plugins? Why?

One thing you might be curious about is the [inferred tasks](/concepts/inferred-tasks). You may wonder why we are detecting tasks from your tooling configuration instead of directly defining them in `package.json` scripts or in the `project.json` file.

Nx understands and supports both approaches, allowing you to define tasks in your `package.json` and `project.json` files or have Nx plugins automatically detect them. The inferred tasks give you the benefit of automatically setting the Nx cache settings for you based on your tooling configuration. In this tutorial, we take advantage of those inferred tasks to demonstrate the full value of Nx plugins.

So, what are Nx Plugins? Nx Plugins are optional packages that extend the capabilities of Nx, catering to various specific technologies. For instance, we have plugins tailored to React (e.g., `@nx/react`), Vite (`@nx/vite`), Cypress (`@nx/cypress`), and more. These plugins offer additional features, making your development experience more efficient and enjoyable when working with specific tech stacks.

[Visit our "Why Nx" page](/getting-started/why-nx) for more details.

## Creating New Components

You can just create new React components as you normally would. However, Nx plugins usually also ship [generators](/features/generate-code). They allow you to easily scaffold code, configuration or entire projects. To see what capabilities the `@nx/react` plugin ships, run the following command and inspect the output:

```{% command="npx nx list @nx/react" path="myreactapp" %}

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
   host : Generate a host react application
   remote : Generate a remote react application
   cypress-component-configuration : Setup Cypress component testing for a React project
   component-test : Generate a Cypress component test for a React component
   setup-tailwind : Set up Tailwind configuration for a project.
   setup-ssr : Set up SSR configuration for a project.
   federate-module : Federate a module.

   EXECUTORS/BUILDERS

   module-federation-dev-server : Serve a host or remote application.
   module-federation-ssr-dev-server : Serve a host application along with it's known remotes.
```

{% callout type="info" title="Prefer a more visual UI?" %}

If you prefer a more integrated experience, you can install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the integrate with editors article](/getting-started/editor-setup).

{% /callout %}

Run the following command to generate a new "hello-world" component. Note how we append `--dry-run` to first check the output.

```{% command="npx nx g @nx/react:component --directory=src/app/hello-world hello-world --dry-run" path="myreactapp" %}
NX  Generating @nx/react:component

✔ Should this component be exported in the project? (y/N) · false
✔ Where should the component be generated? · src/app/hello-world/hello-world.tsx
CREATE src/app/hello-world/hello-world.module.css
CREATE src/app/hello-world/hello-world.spec.tsx
CREATE src/app/hello-world/hello-world.tsx

NOTE: The "dryRun" flag means no changes were made.
```

As you can see it generates a new component in the `app/hello-world/` folder. If you want to actually run the generator, remove the `--dry-run` flag.

```tsx {% fileName="src/app/hello-world/hello-world.tsx" %}
import styles from './hello-world.module.css';

/* eslint-disable-next-line */
export interface HelloWorldProps {}

export function HelloWorld(props: HelloWorldProps) {
  return (
    <div className={styles['container']}>
      <h1>Welcome to HelloWorld!</h1>
    </div>
  );
}

export default HelloWorld;
```

## Building the App for Deployment

If you're ready and want to ship your application, you can build it using

```{% command="npx nx build" path="myreactapp" %}
vite v4.3.5 building for production...
✓ 33 modules transformed.
dist/myreactapp/index.html                   0.48 kB │ gzip:  0.30 kB
dist/myreactapp/assets/index-e3b0c442.css    0.00 kB │ gzip:  0.02 kB
dist/myreactapp/assets/index-378e8124.js   165.64 kB │ gzip: 51.63 kB
✓ built in 496ms

——————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Successfully ran target build for project reactutorial (1s)
```

All the required files will be placed in the `dist/myreactapp` folder and can be deployed to your favorite hosting provider.

## You're ready to go!

In the previous sections you learned about the basics of using Nx, running tasks and navigating an Nx workspace. You're ready to ship features now!

But there's more to learn. You have two possibilities here:

- [Jump to the next steps section](#next-steps) to find where to go from here or
- keep reading and learn some more about what makes Nx unique when working with React.

## Modularizing your React App with Local Libraries

When you develop your React application, usually all your logic sits in the `app` folder. Ideally separated by various folder names which represent your "domains". As your app grows, this becomes more and more monolithic though.

```
└─ myreactapp
   ├─ ...
   ├─ src
   │  ├─ app
   │  │  ├─ products
   │  │  ├─ cart
   │  │  ├─ ui
   │  │  ├─ ...
   │  │  └─ app.tsx
   │  ├─ ...
   │  └─ main.tsx
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

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for each of these areas using the React library generator:

```
nx g @nx/react:library products --unitTestRunner=vitest --bundler=none --directory=modules/products
nx g @nx/react:library orders --unitTestRunner=vitest --bundler=none --directory=modules/orders
nx g @nx/react:library ui --unitTestRunner=vitest --bundler=none --directory=modules/shared/ui
```

Note how we use the `--directory` flag to place the libraries into a subfolder. You can choose whatever folder structure you like, even keep all of them at the root-level.

Running the above commands should lead to the following directory structure:

```
└─ myreactapp
   ├─ ...
   ├─ modules
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
   ├─ src
   │  ├─ app
   │  │  ├─ hello-world
   │  │  │  ├─ hello-world.module.css
   │  │  │  ├─ hello-world.spec.tsx
   │  │  │  └─ hello-world.tsx
   │  │  └─ ...
   │  ├─ ...
   │  └─ main.tsx
   ├─ ...
```

Each of these libraries

- has a project details view where you can see the available tasks (e.g. running tests for just orders: `nx test orders`)
- has its own `project.json` file where you can customize targets
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the React Application

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@myreactapp/orders": ["modules/orders/src/index.ts"],
      "@myreactapp/products": ["modules/products/src/index.ts"],
      "@myreactapp/ui": ["modules/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our React application. As an example, let's create and expose a `ProductList` component from our `modules/products` library. Either create it by hand or run

```shell
nx g @nx/react:component product-list --directory=modules/products/src/lib/product-list
```

We don't need to implement anything fancy as we just want to learn how to import it into our main React application.

```tsx {% fileName="modules/products/src/lib/product-list/product-list.tsx" %}
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

```ts {% fileName="modules/products/src/index.ts" %}
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

```tsx {% fileName="src/main.tsx" %}
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

```tsx {% fileName="src/app/app.tsx" %}
import { Route, Routes } from 'react-router-dom';

// importing the component from the library
import { ProductList } from '@myreactapp/products';

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

Serving your app (`nx serve`) and then navigating to `/products` should give you the following result:

![products route](/shared/images/tutorial-react-standalone/react-tutorial-products-route.png)

Let's apply the same for our `orders` library.

- generate a new component `OrderList` in `modules/orders` and export it in the corresponding `index.ts` file
- import it into the `app.tsx` and render it via the routing mechanism whenever a user hits the `/orders` route

In the end, your `app.tsx` should look similar to this:

```tsx {% fileName="src/app/app.tsx" %}
import { Route, Routes } from 'react-router-dom';
import { ProductList } from '@myreactapp/products';
import { OrderList } from '@myreactapp/orders';

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

## Visualizing your Project Structure

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
      "name": "myreactapp",
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
    "myreactapp": [
      { "source": "myreactapp", "target": "orders", "type": "static" },
      { "source": "myreactapp", "target": "products", "type": "static" }
    ],
    "e2e": [{ "source": "e2e", "target": "myreactapp", "type": "implicit" }],
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

Notice how `ui` is not yet connected to anything because we didn't import it in any of our projects.

Exercise for you: change the codebase such that `ui` is used by `orders` and `products`. Note: you need to restart the `nx graph` command to update the graph visualization or run the CLI command with the `--watch` flag.

## Imposing Constraints with Module Boundary Rules

Once you modularize your codebase you want to make sure that the modules are not coupled to each other in an uncontrolled way. Here are some examples of how we might want to guard our small demo workspace:

- we might want to allow `orders` to import from `ui` but not the other way around
- we might want to allow `orders` to import from `products` but not the other way around
- we might want to allow all libraries to import the `ui` components, but not the other way around

When building these kinds of constraints you usually have two dimensions:

- **type of project:** what is the type of your library. Example: "feature" library, "utility" library, "data-access" library, "ui" library
- **scope (domain) of the project:** what domain area is covered by the project. Example: "orders", "products", "shared" ... this really depends on the type of product you're developing

Nx comes with a generic mechanism that allows you to assign "tags" to projects. "tags" are arbitrary strings you can assign to a project that can be used later when defining boundaries between projects. For example, go to the `project.json` of your `orders` library and assign the tags `type:feature` and `scope:orders` to it.

```json {% fileName="modules/orders/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:orders"]
}
```

Then go to the `project.json` of your `products` library and assign the tags `type:feature` and `scope:products` to it.

```json {% fileName="modules/products/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:products"]
}
```

Finally, go to the `project.json` of the `ui` library and assign the tags `type:ui` and `scope:shared` to it.

```json {% fileName="modules/shared/ui/project.json" %}
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

To test it, go to your `modules/products/src/lib/product-list/product-list.tsx` file and import the `OrderList` from the `orders` project:

```tsx {% fileName="modules/products/src/lib/product-list/product-list.tsx" %}
import styles from './product-list.module.css';

// This import is not allowed 👇
import { OrderList } from '@myreactapp/orders';

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
✔  nx run myreactapp:lint  [existing outputs match the cache, left as is]
✔  nx run e2e:lint  [existing outputs match the cache, left as is]
✔  nx run ui:lint (1s)

✖  nx run products:lint
   Linting "products"...

   /Users/.../myreactapp/modules/products/src/lib/product-list/product-list.tsx
     3:1  error  A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries

   ✖ 1 problem (1 error, 0 warnings)

   Lint errors found in the listed files.

✔  nx run orders:lint (1s)

————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Ran target lint for 5 projects (1s)

✔    4/5 succeeded [2 read from cache]

✖    1/5 targets failed, including the following:
     - nx run products:lint
```

If you have the ESLint plugin installed in your IDE you should immediately see an error:

![ESLint module boundary error](/shared/images/tutorial-react-standalone/react-standalone-module-boundaries.png)

Learn more about how to [enforce module boundaries](/features/enforce-module-boundaries).

## Migrating to a Monorepo

When you are ready to add another application to the repo, you'll probably want to move `myreactapp` to its own folder. To do this, you can run the [`convert-to-monorepo` generator](/nx-api/workspace/generators/convert-to-monorepo) or [manually move the configuration files](/recipes/tips-n-tricks/standalone-to-integrated).

You can also go through the full [React monorepo tutorial](/getting-started/tutorials/react-monorepo-tutorial)

## Set Up CI for Your React App

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
