---
title: 'Node Standalone Tutorial'
description: In this tutorial you'll create a Node backend-focused workspace with Nx.
---

# Building Node Apps with the Nx Standalone Setup

In this tutorial you'll learn how to use Node with Nx in a ["standalone" (non-monorepo) setup](/concepts/integrated-vs-package-based#standalone-applications).

What are you going to learn?

- how to create a new Node application
- how to run a single task (i.e. serve your API) or run multiple tasks in parallel
- how to leverage code generators to scaffold code
- how to modularize your codebase and impose architectural constraints for better maintainability

<!-- {% callout type="info" title="Looking for Node monorepos?" %}
Note, this tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for a Node monorepo setup then check out our [Node monorepo tutorial](/node-tutorial/1-code-generation).

{% /callout %} -->

Note, while you could easily use Nx together with your manually set up Node application, we're going to use the `@nx/node` plugin for this tutorial which provides some nice enhancements when working with Node. [Visit our "Why Nx" page](/getting-started/why-nx) to learn more about plugins and what role they play in the Nx architecture.

## Warm Up

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/node-standalone" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/node-standalone?file=README.md" /%} -->

## Creating a new Node App

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=64" /%} -->

Create a new standalone Node application with the following command:

```{% command="npx create-nx-workspace@latest store-api --preset=node-standalone" path="~" %}
 >  NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ What framework should be used? · express
✔ Would you like to generate a Dockerfile? [https://docs.docker.com/] · Yes
✔ Enable distributed caching to make your CI faster · Yes
```

The `node-standalone` preset automatically creates a `store-api` application at the root of the workspace and an `e2e` project that runs against it.

{% callout type="note" title="Framework Options" %}
This tutorial uses the `express` framework. The `node-standalone` preset also provides starter files for `koa` and `fastify`. For other frameworks, you can choose `none` and add a it yourself.
{% /callout %}

The above command generates the following structure:

```
└─ store-api
   ├─ ...
   ├─ e2e
   │  └─ ...
   ├─ src
   │  ├─ assets
   │  └─ main.ts
   ├─ nx.json
   ├─ package.json
   ├─ project.json
   ├─ tsconfig.app.json
   ├─ tsconfig.json
   └─ tsconfig.spec.json
```

The setup includes..

- a new Node application at the root of the Nx workspace (`src/app`)
- a Cypress based set of e2e tests (`e2e/`)
- Prettier preconfigured
- ESLint preconfigured
- Jest preconfigured

Let me explain a couple of things that might be new to you.

| File           | Description                                                                                                                                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx.json`      | This is where we fine-tune how Nx works. We define what [cacheable operations](/core-features/cache-task-results) there are, and configure our [task pipeline](/concepts/task-pipeline-configuration). More on that soon.                            |
| `project.json` | This file contains the targets that can be invoked for the `store-api` project. It is like a more evolved version of simple `package.json` scripts with more metadata attached. You can read more about it [here](/reference/project-configuration). |

## Serving the App

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=207" /%} -->

The most common tasks are already mapped in the `package.json` file:

```json {% fileName="package.json" %}
{
  "name": "store-api",
  "scripts": {
    "start": "nx serve",
    "build": "nx build",
    "test": "nx test"
  }
  ...
}
```

To serve your new Node application, just run: `npm start`. Alternatively you can directly use Nx by using

```shell
nx serve
```

Your application should be served at [http://localhost:3000](http://localhost:3000).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

All targets, such as `serve`, `build`, `test` or your custom ones, are defined in the `project.json` file.

```json {% fileName="project.json"}
{
  "name": "store-api",
  ...
  "targets": {
    "build": { ... },
    "serve": { ... },
    "lint": { ... },
    "test": { ... },
    "docker-build": { ... },
  },
}
```

{% callout type="info" title="You can also use the package.json" %}

Note that Nx can pick up tasks from both the `package.json` as well as the `project.json`. [Read more](/core-features/run-tasks)

{% /callout %}

Each target contains a configuration object that tells Nx how to run that target.

```json {% fileName="project.json"}
{
  "name": "store-api",
  ...
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "store-api:build"
      },
      "configurations": {
        "development": {
          "buildTarget": "store-api:build:development"
        },
        "production": {
          "buildTarget": "store-api:build:production"
        }
      }
     },
     ...
  },
}
```

The most critical parts are:

- `executor` - this is of the syntax `<plugin>:<executor-name>`, where the `plugin` is an NPM package containing an [Nx Plugin](/extending-nx/intro/getting-started) and `<executor-name>` points to a function that runs the task. In this case, the `@nx/js` plugin contains the `node` executor which runs the Node app.
- `options` - these are additional properties and flags passed to the executor function to customize it

Learn more about how to [run tasks with Nx](/core-features/run-tasks).

## Testing and Linting - Running Multiple Tasks

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=410" /%} -->

Our current setup doesn't just come with targets for serving and building the Node application, but also has targets for unit testing, e2e testing and linting. Again, these are defined in the `project.json` file. We can use the same syntax as before to run these tasks:

```bash
nx test # runs tests using Jest
nx lint # runs linting with ESLint
```

More conveniently, we can also run them in parallel using the following syntax:

```{% command="nx run-many -t test lint" path="store-api" %}

    ✔  nx run store-api:lint (756ms)
    ✔  nx run e2e:lint (772ms)
    ✔  nx run store-api:test (2s)

 ———————————————————————————————————————————————————————————————

 >  NX   Successfully ran targets test, lint for 2 projects (2s)
```

### Caching

One thing to highlight is that Nx is able to [cache the tasks you run](/core-features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="nx run-many -t test lint" path="store-api" %}

    ✔  nx run store-api:lint  [existing outputs match the cache, left as is]
    ✔  nx run e2e:lint  [existing outputs match the cache, left as is]
    ✔  nx run store-api:test  [existing outputs match the cache, left as is]

 ——————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran targets test, lint for 2 projects (49ms)

   Nx read the output from the cache instead of running the command for 3 out of 3 tasks.
```

Not all tasks might be cacheable though. You can configure `cacheableOperations` in the `nx.json` file. You can also [learn more about how caching works](/core-features/cache-task-results).

## Nx Plugins? Why?

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=598" /%} -->

One thing you might be curious about is the project.json. You may wonder why we define tasks inside the `project.json` file instead of using the `package.json` file with scripts that directly run Node.

Nx understands and supports both approaches, allowing you to define targets either in your `package.json` or `project.json` files. While both serve a similar purpose, the `project.json` file can be seen as an advanced form of `package.json` scripts, providing additional metadata and capabilities. In this tutorial, we utilize the `project.json` approach primarily because we take advantage of Nx Plugins.

So, what are Nx Plugins? Nx Plugins are optional packages that extend the capabilities of Nx, catering to various specific technologies. For instance, we have plugins tailored to Node (e.g., `@nx/node`), Jest (`@nx/jest`), ESLint (`@nx/linter`), and more. These plugins offer additional features, making your development experience more efficient and enjoyable when working with specific tech stacks.

[visit our "Why Nx" page](/getting-started/why-nx) for more details.

## Modularizing your Node App with Local Libraries

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=986" /%} -->

When you develop your Node application, usually all your logic sits in the `src` folder. Ideally separated by various folder names which represent your "domains". As your app grows, this becomes more and more monolithic though.

```
└─ store-api
   ├─ ...
   ├─ src
   │  ├─ auth
   │  ├─ orders
   │  ├─ products
   │  ├─ ...
   │  ├─ assets
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

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1041" /%} -->

Let's assume we have a domain areas include `products`, `orders` and some more shared authentication logic in `auth`. We can generate a new library for each of these areas using the Node library generator:

```
nx g @nx/node:library products --directory="modules/products"
nx g @nx/node:library orders --directory="modules/orders"
nx g @nx/node:library auth --directory="modules/shared/auth"
```

Note how we use the `--directory` flag to place the libraries into a subfolder. You can choose whatever folder structure you like, even keep all of them at the root-level.

Running the above commands should lead to the following directory structure:

```
└─ store-api
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
   │  │  └─ tsconfig.spec.json
   │  ├─ orders
   │  │  ├─ ...
   │  │  ├─ project.json
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  └─ ...
   │  │  └─ ...
   │  └─ shared
   │     └─ auth
   │        ├─ ...
   │        ├─ project.json
   │        ├─ src
   │        │  ├─ index.ts
   │        │  └─ ...
   │        └─ ...
   ├─ src
   │  ├─ assets
   │  ├─ ...
   │  └─ main.ts
   ├─ ...
```

Each of these libraries

- has its own `project.json` file with corresponding targets you can run (e.g. running tests for just orders: `nx test orders`)
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the Node Application

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1245" /%} -->

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "products": ["modules/products/src/index.ts"],
      "orders": ["modules/orders/src/index.ts"],
      "auth": ["modules/shared/auth/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our Node application. As an example, let's return an array of products from the generated `products` function of our `modules/products` library. We don't need to implement anything fancy as we just want to learn how to import it into our main Node application.

```ts {% fileName="modules/products/src/lib/products.ts" %}
export function products(): string[] {
  return ['Product 1', 'Product 2', 'Product 3'];
}
```

Make sure the `products` function is exported via the `index.ts` file of our `products` library. This is our public API with the rest of the workspace. Only export what's really necessary to be usable outside the library itself.

```ts {% fileName="modules/products/src/index.ts" %}
export * from './lib/products';
```

We're ready to import it into our main application now. Let's create a `/products` endpoint and return the list of products from it.

```ts {% fileName="src/main.ts" %}
import { products } from 'products';
import express from 'express';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.get('/', (req, res) => {
  res.send({ message: 'Hello API' });
});

app.get('/products', (req, res) => {
  res.send(products());
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
```

Serving your app (`nx serve`) and then navigating to `/products` should give you the following result:

![products route](/shared/images/tutorial-node-standalone/app-products-endpoint.png)

Let's apply the same for our `orders` library.

- update the `orders` function in `modules/orders` to return an array of orders
- import it into the `main.ts` and create a `/orders` endpoint to return the orders

In the end, your `main.ts` should look similar to this:

```ts {% fileName="src/main.ts" %}
import { products } from 'products';
import { orders } from 'orders';
import express from 'express';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.get('/', (req, res) => {
  res.send({ message: 'Hello API' });
});

app.get('/products', (req, res) => {
  res.send(products());
});

app.get('/orders', (req, res) => {
  res.send(orders());
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
```

## Visualizing your Project Structure

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1416" /%} -->

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
      "name": "store-api",
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
      "name": "auth",
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
    "store-api": [
      { "source": "store-api", "target": "orders", "type": "static" },
      { "source": "store-api", "target": "products", "type": "static" }
    ],
    "e2e": [{ "source": "e2e", "target": "store-api", "type": "implicit" }],
    "auth": [],
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

Notice how `auth` is not yet connected to anything because we didn't import it in any of our projects.

Exercise for you: change the codebase such that `auth` is used by `orders` and `products`. Note: you need to restart the `nx graph` command to update the graph visualization or run the CLI command with the `--watch` flag.

## Building the App for Deployment

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=856" /%} -->

If you're ready and want to ship your application, you can build it using

```{% command="npx nx build" path="store-api" %}
> nx run store-api:build:production


 ——————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project store-api (1s)
```

All the required files will be placed in the `dist/store-api` folder and can be deployed to your favorite hosting provider.

Because we opted into generating a Dockerfile, there's also a task for building a docker image. Make sure Docker is started and run

```shell
npx nx docker-build
```

## Imposing Constraints with Module Boundary Rules

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1456" /%} -->

Once you modularize your codebase you want to make sure that the modules are not coupled to each other in an uncontrolled way. Here are some examples of how we might want to guard our small demo workspace:

- we might want to allow `orders` to import from `auth` but not the other way around
- we might want to allow `orders` to import from `products` but not the other way around
- we might want to allow all libraries to import from `auth`, but not the other way around

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

Finally, go to the `project.json` of the `auth` library and assign the tags `type:data-access` and `scope:shared` to it.

```json {% fileName="modules/shared/ui/project.json" %}
{
  ...
  "tags": ["type:data-access", "scope:shared"]
}
```

Notice how we assign `scope:shared` to our auth library because it is intended to be used throughout the workspace.

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

To test it, go to your `modules/products/src/lib/products.ts` file and import the `orders` function from the `orders` project:

```ts {% fileName="modules/products/src/lib/products.ts" %}
// This import is not allowed 👇
import { orders } from 'orders';

export function products(): string[] {
  return ['Product 1', 'Product 2', 'Product 3'];
}
```

If you lint your workspace you'll get an error now:

```{% command="nx run-many -t lint" %}
 >  NX   Running target lint for 5 projects
    ✖  nx run products:lint
       Linting "products"...

       /Users/isaac/Documents/node-standalone/modules/products/src/lib/products.ts
         2:1   error    A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries
         2:10  warning  'orders' is defined but never used                                                                           @typescript-eslint/no-unused-vars

       ✖ 2 problems (1 error, 1 warning)

       Lint warnings found in the listed files.

       Lint errors found in the listed files.


    ✔  nx run store-api:lint (826ms)
    ✔  nx run orders:lint (827ms)
    ✔  nx run auth:lint (562ms)
    ✔  nx run e2e:lint (574ms)

 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Ran target lint for 5 projects (1s)

    ✔    4/5 succeeded [0 read from cache]

    ✖    1/5 targets failed, including the following:
         - nx run products:lint
```

If you have the ESLint plugin installed in your IDE you should immediately see an error:

![ESLint module boundary error](/shared/images/tutorial-node-standalone/node-standalone-module-boundaries.png)

Learn more about how to [enforce module boundaries](/core-features/enforce-module-boundaries).

## Next Steps

Here's some more things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- [Deploying a Node App to Fly.io](/recipes/node/node-server-fly-io)
- [Add and Deploy Netlify Edge Functions with Node](/recipes/node/node-serverless-functions-netlify)
- [Deploying AWS lambda in Node.js](/recipes/node/node-aws-lambda)
- [Speed up CI: Run only tasks for project that got changed](/core-features/run-tasks#run-tasks-affected-by-a-pr)]
- [Speed up CI: Share your cache](/core-features/remote-cache)]
- [Speed up CI: Distribute your tasks across machines](/core-features/distribute-task-execution)

Also, make sure you

- [Join the Official Nx Discord Server](http://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
