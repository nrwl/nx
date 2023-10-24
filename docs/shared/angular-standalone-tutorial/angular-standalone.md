# Building Angular Apps with the Nx Standalone Projects Setup

In this tutorial you'll learn how to use Angular with Nx in a ["standalone" (non-monorepo) setup](/concepts/integrated-vs-package-based#standalone-applications). Not to be confused with the "Angular Standalone API", a standalone project in Nx is a non-monorepo setup where you have a single application at the root level. This setup is very similar to what the Angular CLI gives you.

What are you going to learn?

- how to create a new standalone (single-project) Nx workspace setup for Angular
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

{% callout type="info" title="Looking for Angular monorepos?" %}
Note, this tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for an Angular monorepo setup then check out our [Angular monorepo tutorial](/getting-started/tutorials/angular-monorepo-tutorial).

{% /callout %}

## Warm Up

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/angular-standalone" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/angular-standalone?file=README.md" /%} -->

Also, if you prefer learning with a video, join Juri and walk through the tutorial, step by step together.

{% youtube
src="https://www.youtube.com/embed/ZAO0yXupIIE"
title="Tutorial: Standalone Angular Application"
/%}

## Creating a new Angular App

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=49" /%}

Create a new Angular application with the following command:

```{% command="npx create-nx-workspace@latest myngapp --preset=angular-standalone" path="~" %}
✔ Default stylesheet format · css
✔ Test runner to use for end to end (E2E) tests · cypress
✔ Would you like to use Standalone Components in your application? · Yes
✔ Would you like to add routing? · Yes
✔ Enable distributed caching to make your CI faster · Yes
```

You get asked a few questions that help Nx preconfigure your new Angular application. These include

- Angular specific questions, such as whether you want to have the router set up for you, whether to use the Angular Standalone API and which stylesheet format to use
- General Nx questions, such as whether to enable distributed caching with Nx Cloud. Nx comes with built-in [local caching](/core-features/cache-task-results). If you want to benefit from this cache in CI, you can enable [distributed caching](/core-features/remote-cache) which will set up [Nx Cloud](https://nx.app). This is also a prerequisite for enabling [distributed task execution](/core-features/distribute-task-execution).

For the sake of this tutorial, let's respond to all the questions with "yes".

The `create-nx-workspace` command generates the following structure:

```
└─ myngapp
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
   │  │  ├─ app.component.css
   │  │  ├─ app.component.html
   │  │  ├─ app.component.spec.ts
   │  │  ├─ app.component.ts
   │  │  ├─ app.config.ts
   │  │  ├─ app.routes.ts
   │  │  └─ nx-welcome.component.ts
   │  ├─ assets
   │  ├─ favicon.ico
   │  ├─ index.html
   │  ├─ main.ts
   │  ├─ styles.css
   │  └─ test-setup.ts
   ├─ jest.config.ts
   ├─ jest.preset.js
   ├─ nx.json
   ├─ package-lock.json
   ├─ package.json
   ├─ project.json
   ├─ README.md
   ├─ tsconfig.app.json
   ├─ tsconfig.editor.json
   ├─ tsconfig.json
   └─ tsconfig.spec.json
```

The setup includes..

- a new Angular application at the root of the Nx workspace (`src/app`)
- a Cypress based set of e2e tests (`e2e/`)
- Prettier preconfigured
- ESLint & Angular ESLint preconfigured
- Jest preconfigured

Compared to the Angular CLI, you might notice the addition of an `nx.json` file and the absence of an `angular.json` file. Instead of the `angular.json` file there is a `project.json` file. Each file is described below:

| File           | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nx.json`      | This is where we can fine-tune how Nx works, define the [cacheable operations](/core-features/cache-task-results), our [task pipelines](/concepts/task-pipeline-configuration) as well as defaults for the Nx generators. Find more details in [the reference docs](/reference/nx-json).                                                                                                                                                                                                                                |
| `project.json` | Nx uses this file to define targets that can be run, similar to how the Angular CLI uses the `angular.json` file. If you're familiar with the Angular CLI you should have no difficulty navigating the `project.json` file. If you're curious how the two compare, you can learn more in [the Nx and Angular CLI comparision article](/concepts/more-concepts/nx-and-angular). The [project-configuration documentation page](/reference/project-configuration) has more details on how to use the `project.json` file. |

## Serving the App

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=296" /%}

The most common tasks are already defined in the `package.json` file:

```json {% fileName="package.json" %}
{
  "name": "myngapp",
  "scripts": {
    "start": "nx serve",
    "build": "nx build",
    "test": "nx test"
  }
  ...
}
```

To serve your new Angular application, just run: `npm start`. Alternatively you can directly use Nx by using

```shell
nx serve
```

Your application should be served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

All targets, such as `serve`, `build`, `test` or your custom ones, are defined in the `project.json` file.

```json {% fileName="project.json"}
{
  "name": "myngapp",
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

Each target contains a configuration object that tells Nx how to run that target.

```json {% fileName="project.json"}
{
  "name": "myngapp",
  ...
  "targets": {
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "configurations": {
        "production": {
          "browserTarget": "myngapp:build:production"
        },
        "development": {
          "browserTarget": "myngapp:build:development"
        }
      },
      "defaultConfiguration": "development"
    },
    ...
  },
}
```

The most critical parts are:

- `executor` - This corresponds to the `builder` property in an Angular CLI workspace. You can use Angular builders or executors from [Nx plugins](/extending-nx/intro/getting-started).
- `options` - these are additional properties and flags passed to the executor function to customize it

Learn more about how to [run tasks with Nx](/core-features/run-tasks).

## Testing and Linting - Running Multiple Tasks

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=369" /%}

Our current setup not only has targets for serving and building the Angular application, but also has targets for unit testing, e2e testing and linting. Again, these are defined in the `project.json` file. We can use the same syntax as before to run these tasks:

```bash
nx test # runs tests using Jest
nx lint # runs linting with ESLint
nx e2e e2e # runs e2e tests with Cypress
```

More conveniently, we can also run them in parallel using the following syntax:

```{% command="nx run-many -t test lint e2e" path="myngapp" %}

    ✔  nx run e2e:lint (1s)
    ✔  nx run myngapp:lint (1s)
    ✔  nx run myngapp:test (2s)
    ✔  nx run e2e:e2e (6s)

 ——————————————————————————————————————————————————————

 >  NX   Successfully ran targets test, lint, e2e for 2 projects (8s)
```

### Caching

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=443" /%}

One thing to highlight is that Nx is able to [cache the tasks you run](/core-features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="nx run-many -t test lint e2e" path="myngapp" %}

    ✔  nx run myngapp:lint  [existing outputs match the cache, left as is]
    ✔  nx run e2e:lint  [existing outputs match the cache, left as is]
    ✔  nx run myngapp:test  [existing outputs match the cache, left as is]
    ✔  nx run e2e:e2e  [existing outputs match the cache, left as is]

 ———————————————————————————————————————————————————————

 >  NX   Successfully ran targets test, lint, e2e for 2 projects (143ms)

   Nx read the output from the cache instead of running the command for 4 out of 4 tasks.
```

Not all tasks might be cacheable though. You can configure the `cache` properties in the targets under `targetDefaults` in the `nx.json` file. You can also [learn more about how caching works](/core-features/cache-task-results).

## Creating New Components

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=500" /%}

Similar to the Angular CLI, Nx comes with code generation abilities. What the Angular CLI calls "Schematics", Nx calls "Generators".

Generators allow you to easily scaffold code, configuration or entire projects. To see what capabilities the `@nx/angular` plugin ships with, run the following command and inspect the output:

```{% command="npx nx list @nx/angular" path="myngapp" %}

 >  NX   Capabilities in @nx/angular:

>  NX   Capabilities in @nx/angular:

   GENERATORS

   add-linting : Adds linting configuration to an Angular project.
   application : Creates an Angular application.
   component : Generate an Angular Component.
   ...
   library : Creates an Angular library.
   library-secondary-entry-point : Creates a secondary entry point for an Angular publishable library.
   remote : Generate a Remote Angular Module Federation Application.
   move : Moves an Angular application or library to another folder within the workspace and updates the project configuration.
   convert-to-with-mf : Converts an old micro frontend configuration...
   host : Generate a Host Angular Module Federation Application.
   ng-add : Migrates an Angular CLI workspace to Nx or adds the Angular plugin to an Nx workspace.
   ngrx : Adds NgRx support to an application or library.
   scam-to-standalone : Convert an existing Single Component Angular Module (SCAM) to a Standalone Component.
   scam : Generate a component with an accompanying Single Component Angular Module (SCAM).
   scam-directive : Generate a directive with an accompanying Single Component Angular Module (SCAM).
   scam-pipe : Generate a pipe with an accompanying Single Component Angular Module (SCAM).
   setup-mf : Generate a Module Federation configuration for a given Angular application.
   setup-ssr : Generate Angular Universal (SSR) setup for an Angular application.
   setup-tailwind : Configures Tailwind CSS for an application or a buildable/publishable library.
   stories : Creates stories/specs for all components declared in a project.
   storybook-configuration : Adds Storybook configuration to a project.
   cypress-component-configuration : Setup Cypress component testing for a project.
   web-worker : Creates a Web Worker.
   directive : Generate an Angular directive.
   ngrx-feature-store : Adds an NgRx Feature Store to an application or library.
   ngrx-root-store : Adds an NgRx Root Store to an application.
   pipe : Generate an Angular Pipe

   EXECUTORS/BUILDERS/

   delegate-build : Delegates the build to a different target while supporting incremental builds.
   ...
```

{% callout type="info" title="Prefer a more visual UI?" %}

If you prefer a more integrated experience, you can install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the integrate with editors article](/core-features/integrate-with-editors).

{% /callout %}

Run the following command to generate a new "hello-world" component. Note how we append `--dry-run` to first check the output.

```{% command="npx nx g @nx/angular:component hello-world --directory=src/app/hello-world --standalone --dry-run" path="myngapp" %}
>  NX  Generating @nx/angular:component

CREATE src/app/hello-world/hello-world.component.css
CREATE src/app/hello-world/hello-world.component.html
CREATE src/app/hello-world/hello-world.component.spec.ts
CREATE src/app/hello-world/hello-world.component.ts

NOTE: The "dryRun" flag means no changes were made.
```

As you can see it generates a new component in the `app/hello-world/` folder. If you want to actually run the generator, remove the `--dry-run` flag.

```ts {% fileName="src/app/hello-world/hello-world.component.ts" %}
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'myngapp-hello-world',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hello-world.component.html',
  styleUrls: ['./hello-world.component.css'],
})
export class HelloWorldComponent {}
```

## Building the App for Deployment

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=680" /%}

If you're ready and want to ship your application, you can build it using

```{% command="npx nx build" path="myngapp" %}
> nx run myngapp:build:production

✔ Browser application bundle generation complete.
✔ Copying assets complete.
✔ Index html generation complete.

Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.afa99fe9f64fbdd9.js      | main          | 193.58 kB |                51.57 kB
polyfills.1acfd3f58d94d542.js | polyfills     |  32.98 kB |                10.66 kB
runtime.37059233034b21c2.js   | runtime       | 892 bytes |               515 bytes
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 227.44 kB |                62.73 kB

Build at: 2023-05-23T14:00:31.981Z - Hash: 9086e92ce0bfefca - Time: 5228ms

 ——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project myngapp (7s)
```

All the required files will be placed in the `dist/myngapp` folder and can be deployed to your favorite hosting provider.

## You're ready to go!

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=723" /%}

In the previous sections you learned about the basics of using Nx, running tasks and navigating an Nx workspace. You're ready to ship features now!

But there's more to learn. You have two possibilities here:

- [Jump to the next steps section](#next-steps) to find where to go from here or
- keep reading and learn some more about what makes Nx unique when working with Angular.

## Modularizing your Angular App with Local Libraries

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=750" /%}

When you develop your Angular application, usually all your logic sits in the `app` folder. Ideally separated by various folder names which represent your "domains". As your app grows, this becomes more and more monolithic though.

The following structure is a common example of this kind of monolithic code organization:

```
└─ myngapp
   ├─ ...
   ├─ src
   │  ├─ app
   │  │  ├─ products
   │  │  ├─ cart
   │  │  ├─ ui
   │  │  ├─ ...
   │  │  └─ app.component.ts
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

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=818" /%}

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for each of these areas using the Angular library generator:

```
nx g @nx/angular:library products --directory=modules/products --standalone
nx g @nx/angular:library orders --directory=modules/orders --standalone
nx g @nx/angular:library shared-ui --directory=modules/shared/ui --standalone
```

Note how we use the `--directory` flag to place the libraries into a subfolder. You can choose whatever folder structure you like, even keep all of them at the root-level.

Running the above commands should lead to the following directory structure:

```
└─ myngapp
   ├─ ...
   ├─ e2e/
   ├─ modules
   │  ├─ products
   │  │  ├─ .eslintrc.json
   │  │  ├─ README.md
   │  │  ├─ jest.config.ts
   │  │  ├─ project.json
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  ├─ lib
   │  │  │  │  └─ products
   │  │  │  │     ├─ products.component.css
   │  │  │  │     ├─ products.component.html
   │  │  │  │     ├─ products.component.spec.ts
   │  │  │  │     └─ products.component.ts
   │  │  │  └─ test-setup.ts
   │  │  ├─ tsconfig.json
   │  │  ├─ tsconfig.lib.json
   │  │  └─ tsconfig.spec.json
   │  ├─ orders
   │  │  ├─ ...
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  ├─ lib
   │  │  │  │  └─ orders
   │  │  │  │     ├─ ...
   │  │  │  │     └─ orders.component.ts
   │  │  ├─ ...
   │  └─ shared
   │     └─ ui
   │        ├─ ...
   │        ├─ src
   │        │  ├─ index.ts
   │        │  ├─ lib
   │        │  │  └─ shared-ui
   │        │  │     ├─ ...
   │        │  │     └─ shared-ui.component.ts
   │        └─ ...
   ├─ ...
   ├─ src
   │  ├─ app
   │  │  ├─ ...
   │  │  ├─ app.component.ts
   │  ├─ ...
   ├─ ...
```

Each of these libraries

- has its own `project.json` file with corresponding targets you can run (e.g. running tests for just orders: `nx test orders`)
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the Angular Application

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=976" /%}

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@myngapp/orders": ["modules/orders/src/index.ts"],
      "@myngapp/products": ["modules/products/src/index.ts"],
      "@myngapp/shared-ui": ["modules/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our Angular application. For example: let's use our existing `ProductsComponent` in `modules/products/src/lib/products/`:

```ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'myngapp-products',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
})
export class ProductsComponent {}
```

Make sure the `ProductsComponent` is exported via the `index.ts` file of our `products` library (which it should already be). The `modules/products/src/index.ts` file is the public API for the `products` library with the rest of the workspace. Only export what's really necessary to be usable outside the library itself.

```ts {% fileName="modules/products/src/index.ts" %}
export * from './lib/products/products.component';
```

We're ready to import it into our main application now. If you opted into generating a router configuration when setting up the Nx workspace initially, you should have an `app.routes.ts` file in your `app` folder. If not, create it and configure the Angular router.

Configure the routing as follows:

```ts {% fileName="src/app/app.routes.ts" %}
import { Route } from '@angular/router';
import { NxWelcomeComponent } from './nx-welcome.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: NxWelcomeComponent,
    pathMatch: 'full',
  },
  {
    path: 'products',
    loadComponent: () =>
      import('@myngapp/products').then((m) => m.ProductsComponent),
  },
];
```

As part of this step, we should also remove the `NxWelcomeComponent` from the `AppComponent.imports` declaration so that it is just loaded over the routing mechanism. The `app.component.html` should just have the `<router-outlet>` left:

```html {% fileName="src/app/app.component.html" %}
<router-outlet></router-outlet>
```

If you now navigate to [http://localhost:4200/products](http://localhost:4200/products) you should see the `ProductsComponent` being rendered.

![Browser screenshot of navigating to the products route](/shared/images/tutorial-angular-standalone/app-products-route.png)

Let's do the same process for our `orders` library. Import the `OrdersComponent` into the `app.routes.ts`:

```ts {% fileName="src/app/app.routes.ts" %}
import { Route } from '@angular/router';
import { NxWelcomeComponent } from './nx-welcome.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: NxWelcomeComponent,
    pathMatch: 'full',
  },
  {
    path: 'products',
    loadComponent: () =>
      import('@myngapp/products').then((m) => m.ProductsComponent),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('@myngapp/orders').then((m) => m.OrdersComponent),
  },
];
```

Similarly, navigating to [http://localhost:4200/orders](http://localhost:4200/orders) should now render the `OrdersComponent`.

A couple of notes:

- both the `ProductsComponent` and `OrdersComponent` are lazy loaded
- you could go even further and configure routes within the libraries and only import and attach those routes to the application routing mechanism.

## Visualizing your Project Structure

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=958" /%}

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/core-features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `nx build`, identifying [affected projects](/core-features/run-tasks#run-tasks-affected-by-a-pr) and more. Interestingly you can also visualize it.

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
      "name": "myngapp",
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
    "myngapp": [
      { "source": "myngapp", "target": "orders", "type": "dynamic" },
      { "source": "myngapp", "target": "products", "type": "dynamic" }
    ],
    "e2e": [{ "source": "e2e", "target": "myngapp", "type": "implicit" }],
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

{% video-link link="https://youtu.be/ZAO0yXupIIE?t=1147" /%}

Once you modularize your codebase you want to make sure that the modules are not coupled to each other in an uncontrolled way. Here are some examples of how we might want to guard our small demo workspace:

- we might want to allow `orders` to import from `shared-ui` but not the other way around
- we might want to allow `orders` to import from `products` but not the other way around
- we might want to allow all libraries to import the `shared-ui` components, but not the other way around

When building these kinds of constraints you usually have two dimensions:

- **type of project:** what is the type of your library. Example: "feature" library, "utility" library, "data-access" library, "ui" library (see [library types](/concepts/more-concepts/library-types))
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

To test it, go to your `modules/products/src/lib/products/products.component.ts` file and import the `OrderComponent` from the `orders` project:

```tsx {% fileName="modules/products/src/lib/products/products.component.ts" %}
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// 👇 this import is not allowed
import { OrdersComponent } from '@myngapp/orders';

@Component({
  selector: 'myngapp-products',
  standalone: true,
  imports: [CommonModule, OrdersComponent],
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
})
export class ProductsComponent {}
```

If you lint your workspace you'll get an error now:

```{% command="nx run-many -t lint" %}
    ✖  nx run products:lint
       Linting "products"...

       /Users/juri/nrwl/content/myngapp/modules/products/src/lib/products/products.component.ts
         3:1  error  A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries

       ✖ 1 problem (1 error, 0 warnings)

       Lint errors found in the listed files.

    ✔  nx run orders:lint (1s)
    ✔  nx run myngapp:lint (1s)
    ✔  nx run e2e:lint (682ms)
    ✔  nx run shared-ui:lint (797ms)

 —————————————————————————————————————————————————————————————————————

 >  NX   Ran target lint for 5 projects (2s)

    ✔    4/5 succeeded [0 read from cache]

    ✖    1/5 targets failed, including the following:
         - nx run products:lint

```

If you have the ESLint plugin installed in your IDE you should immediately see an error:

![ESLint module boundary error](/shared/images/tutorial-angular-standalone/boundary-rule-violation-vscode.png)

Learn more about how to [enforce module boundaries](/core-features/enforce-module-boundaries).

## Migrating to a Monorepo

When you are ready to add another application to the repo, you'll probably want to move `myngapp` to its own folder. To do this, you can run the [`convert-to-monorepo` generator](/nx-api/workspace/generators/convert-to-monorepo) or [manually move the configuration files](/recipes/tips-n-tricks/standalone-to-integrated).

You can also go through the full [Angular monorepo tutorial](/getting-started/tutorials/angular-monorepo-tutorial)

## Next Steps

Congrats, you made it!! You now know how to leverage the Nx standalone applications preset to build modular Angular applications.

Here's some more things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn about popular generators such as [how to setup Tailwind](/recipes/angular/using-tailwind-css-with-angular-projects) or [add Storybook to your UI library](/recipes/storybook/overview-angular)
- Learn how to [migrate your existing Angular CLI repo to Nx](/recipes/angular/migration/angular)
- [Speed up CI: Run only tasks for project that got changed](/core-features/run-tasks#run-tasks-affected-by-a-pr)
- [Speed up CI: Share your cache](/core-features/remote-cache)
- [Speed up CI: Distribute your tasks across machines](/core-features/distribute-task-execution)

Also, make sure you

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
