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
Note, this tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for a React monorepo setup then check out our [React monorepo tutorial](/react-tutorial/1-code-generation).

{% /callout %}

## Warm Up

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/standalone-react-app" /%}

{% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/standalone-react-app?file=README.md" /%}

## Creating a new React App

Create a new standalone React application with the following command:

```shell {% command="npx create-nx-workspace@latest myreactapp --preset=react-standalone" path="~" %}
? Bundler to be used to build the application …
Vite    [ https://vitejs.dev/ ]
Webpack [ https://webpack.js.org/ ]
Rspack  [ https://www.rspack.dev/ ]
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

| File           | Description                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx.json`      | This is where we fine-tune how Nx works. We define what [cacheable operations](/core-features/cache-task-results) there are, and configure our [task pipeline](/concepts/task-pipeline-configuration). More on that soon.                             |
| `project.json` | This file contains the targets that can be invoked for the `myreactapp` project. It is like a more evolved version of simple `package.json` scripts with more metadata attached. You can read more about it [here](/reference/project-configuration). |

## Serving the App

The most common tasks are already mapped in the `package.json` file:

```json {% fileName="package.json" %}
{
  "name": "reactutorial",
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

All targets, such as `serve`, `build`, `test` or your custom ones, are defined in the `project.json` file.

```json {% fileName="project.json"}
{
  "name": "myreactapp",
  ...
  "targets": {
    "serve": { ... },
    "build": { ... },
    "preview": { ... },
    "test": { ... },
    "lint": { ... },
    "serve-static": { ... },
  },
}
```

{% callout type="info" title="You can also use the package.json" %}

Note that Nx can pick up tasks from both, the `package.json` as well as the `project.json`. [Read more](/core-features/run-tasks)

{% /callout %}

Each target contains a configuration object that tells Nx how to run that target.

```json {% fileName="project.json"}
{
  "name": "myreactapp",
  ...
  "targets": {
    "serve": {
      "executor": "@nx/vite:dev-server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "reactutorial:build"
      },
      "configurations": {
        "development": {
          "buildTarget": "reactutorial:build:development",
          "hmr": true
        },
        "production": {
          "buildTarget": "reactutorial:build:production",
          "hmr": false
        }
      }
     },
     ...
  },
}
```

The most critical parts are:

- `executor` - this is of the syntax `<plugin>:<executor-name>`, where the `plugin` is an NPM package containing an [Nx Plugin](/plugins/intro/getting-started) and `<executor-name>` points to a function that runs the task. In this case, the `@nx/vite` plugin contains the `dev-server` executor which serves the React app using Vite.
- `options` - these are additional properties and flags passed to the executor function to customize it

Learn more about how to [run tasks with Nx](/core-features/run-tasks).

## Testing and Linting - Running Multiple Tasks

Our current setup doesn't just come with targets for serving and building the React application, but also has targets for unit testing, e2e testing and linting. Again, these are defined in the `project.json` file. We can use the same syntax as before to run these tasks:

```bash
nx test # runs tests using Vitest (or you can configure it to use Jest)
nx lint # runs linting with ESLint
nx e2e e2e # runs e2e tests with Cypress
```

More conveniently, we can also run them in parallel using the following syntax:

```shell {% command="nx run-many -t test lint e2e" path="myreactapp" %}

    ✔  nx run e2e:lint (2s)
    ✔  nx run myreactapp:lint (2s)
    ✔  nx run myreactapp:test (2s)
    ✔  nx run e2e:e2e (6s)

 ——————————————————————————————————————————————————————

 >  NX   Successfully ran targets test, lint, e2e for 2 projects (7s)
```

### Caching

One thing to highlight is that Nx is able to [cache the tasks you run](/core-features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```shell {% command="nx run-many -t test lint e2e" path="myreactapp" %}

    ✔  nx run e2e:lint  [existing outputs match the cache, left as is]
    ✔  nx run myreactapp:lint  [existing outputs match the cache, left as is]
    ✔  nx run myreactapp:test  [existing outputs match the cache, left as is]
    ✔  nx run e2e:e2e  [existing outputs match the cache, left as is]

 ——————————————————————————————————————————————————————

 >  NX   Successfully ran targets test, lint, e2e for 5 projects (54ms)

   Nx read the output from the cache instead of running the command for 10 out of 10 tasks.
```

Not all tasks might be cacheable though. You can configure `cacheableOperations` in the `nx.json` file. You can also [learn more about how caching works](/core-features/cache-task-results).

## Creating New Components

You can just create new React components as you normally would. However, Nx plugins usually also ship [generators](/plugin-features/use-code-generators). They allow you to easily scaffold code, configuration or entire projects. To see what capabilities the `@nx/react` plugin ships, run the following command and inspect the output:

```shell {% command="npx nx list @nx/react" path="myreactapp" %}

 >  NX   Capabilities in @nx/react:

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

   EXECUTORS/BUILDERS

   module-federation-dev-server : Serve a host or remote application.
   module-federation-ssr-dev-server : Serve a host application along with it's known remotes.
```

{% callout type="info" title="Prefer a more visual UI?" %}

If you prefer a more integrated experience, you can install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the integrate with editors article](/core-features/integrate-with-editors).

{% /callout %}

Run the following command to generate a new "hello-world" component. Note how we append `--dry-run` to first check the output.

```shell {% command="npx nx g @nx/react:component hello-world --dry-run" path="myreactapp" %}
>  NX  Generating @nx/react:component

✔ Should this component be exported in the project? (y/N) · false
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

```shell {% command="npx nx build" path="myreactapp" %}
vite v4.3.5 building for production...
✓ 33 modules transformed.
dist/myreactapp/index.html                   0.48 kB │ gzip:  0.30 kB
dist/myreactapp/assets/index-e3b0c442.css    0.00 kB │ gzip:  0.02 kB
dist/myreactapp/assets/index-378e8124.js   165.64 kB │ gzip: 51.63 kB
✓ built in 496ms

 ——————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project reactutorial (1s)
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
nx g @nx/react:library products --unitTestRunner=vitest --bundler=none --directory=modules
nx g @nx/react:library orders --unitTestRunner=vitest --bundler=none --directory=modules
nx g @nx/react:library ui --unitTestRunner=vitest --bundler=none --directory=modules/shared
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
   │  │  │     ├─ modules-products.spec.ts
   │  │  │     └─ modules-products.ts
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

- has its own `project.json` file with corresponding targets you can run (e.g. running tests for just orders: `nx test modules-orders`)
- has a name based on the `--directory` flag, e.g. `modules-orders`; you can find the name in the corresponding `project.json` file
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the React Application

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@myreactapp/modules/products": ["modules/products/src/index.ts"],
      "@myreactapp/modules/orders": ["modules/orders/src/index.ts"],
      "@myreactapp/modules/shared/ui": ["modules/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our React application. As an example, let's create and expose a `ProductList` component from our `modules/products` library. Either create it by hand or run

```shell
nx g @nx/react:component product-list --project=modules-products
```

We don't need to implement anything fancy as we just want to learn how to import it into our main React application.

```tsx {% fileName="modules/products/src/lib/product-list.tsx" %}
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

```shell
npm install react-router-dom
```

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
import { ProductList } from '@myreactapp/modules/products';

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
import { ProductList } from '@myreactapp/modules/products';
import { OrderList } from '@myreactapp/modules/orders';

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

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/core-features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `nx build`, identifying [affected projects](/core-features/run-tasks#run-tasks-affected-by-a-pr) and more. Interestingly you can also visualize it.

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
      "name": "modules-shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "modules-orders",
      "type": "lib",
      "data": {
        "tags": []
      }
    },

    {
      "name": "modules-products",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "myreactapp": [
      { "source": "myreactapp", "target": "modules-orders", "type": "static" },
      { "source": "myreactapp", "target": "modules-products", "type": "static" }
    ],
    "e2e": [{ "source": "e2e", "target": "myreactapp", "type": "implicit" }],
    "modules-shared-ui": [],
    "modules-orders": [],
    "modules-products": []
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

Notice how `modules-shared-ui` is not yet connected to anything because we didn't import it in any of our projects.

Exercise for you: change the codebase such that `modules-shared-ui` is used by `modules-orders` and `modules-products`. Note: you need to restart the `nx graph` command to update the graph visualization or run the CLI command with the `--watch` flag.

## Imposing Constraints with Module Boundary Rules

Once you modularize your codebase you want to make sure that the modules are not coupled to each other in an uncontrolled way. Here are some examples of how we might want to guard our small demo workspace:

- we might want to allow `modules-orders` to import from `modules-shared-ui` but not the other way around
- we might want to allow `modules-orders` to import from `modules-products` but not the other way around
- we might want to allow all libraries to import the `modules-shared-ui` components, but not the other way around

When building these kinds of constraints you usually have two dimensions:

- **type of project:** what is the type of your library. Example: "feature" library, "utility" library, "data-access" library, "ui" library
- **scope (domain) of the project:** what domain area is covered by the project. Example: "orders", "products", "shared" ... this really depends on the type of product you're developing

Nx comes with a generic mechanism that allows you to assign "tags" to projects. "tags" are arbitrary strings you can assign to a project that can be used later when defining boundaries between projects. For example, go to the `project.json` of your `modules-orders` library and assign the tags `type:feature` and `scope:orders` to it.

```json {% fileName="modules/orders/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:orders"]
}
```

Then go to the `project.json` of your `modules-products` library and assign the tags `type:feature` and `scope:products` to it.

```json {% fileName="modules/products/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:products"]
}
```

Finally, go to the `project.json` of the `modules-shared-ui` library and assign the tags `type:ui` and `scope:shared` to it.

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

To test it, go to your `modules/products/src/lib/product-list/product-list.tsx` file and import the `OrderList` from the `modules-orders` project:

```tsx {% fileName="modules/products/src/lib/product-list/product-list.tsx" %}
import styles from './product-list.module.css';

// This import is not allowed 👇
import { OrderList } from '@myreactapp/modules/orders';

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

```shell {% command="nx run-many -t lint" %}
    ✔  nx run myreactapp:lint  [existing outputs match the cache, left as is]
    ✔  nx run e2e:lint  [existing outputs match the cache, left as is]
    ✔  nx run modules-shared-ui:lint (1s)

    ✖  nx run modules-products:lint
       Linting "modules-products"...

       /Users/.../myreactapp/modules/products/src/lib/product-list/product-list.tsx
         3:1  error  A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries

       ✖ 1 problem (1 error, 0 warnings)

       Lint errors found in the listed files.

    ✔  nx run modules-orders:lint (1s)

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Ran target lint for 5 projects (1s)

    ✔    4/5 succeeded [2 read from cache]

    ✖    1/5 targets failed, including the following:
         - nx run modules-products:lint
```

If you have the ESLint plugin installed in your IDE you should immediately see an error:

![ESLint module boundary error](/shared/images/tutorial-react-standalone/react-standalone-module-boundaries.png)

Learn more about how to [enforce module boundaries](/core-features/enforce-project-boundaries).

## Next Steps

Here's some more things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn how to [migrate your CRA app to Nx](/recipes/adopting-nx/migration-cra)
- [Learn how to setup Tailwind](/recipes/other/using-tailwind-css-in-react)
- [Setup Storybook for our shared UI library](/packages/storybook/documents/overview-react)
- [Speed up CI: Run only tasks for project that got changed](/core-features/run-tasks#run-tasks-affected-by-a-pr)]
- [Speed up CI: Share your cache](/core-features/share-your-cache)]
- [Speed up CI: Distribute your tasks across machines](/core-features/distribute-task-execution)

Also, make sure you

- [Join the Nx community Slack](https://go.nrwl.io/join-slack) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
