---
title: 'Angular Monorepo Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building Angular Apps in an Nx Monorepo

In this tutorial you'll learn how to use Angular with Nx in a [monorepo (integrated) setup](/concepts/integrated-vs-package-based#integrated-repos).

What are you going to learn?

- how to create a new Angular application
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

{% callout type="info" title="Looking for an Angular standalone app?" %}
Note, this tutorial sets up a repo with applications and libraries in their own subfolders. If you are looking for an Angular standalone app setup then check out our [Angular standalone app tutorial](/getting-started/tutorials/angular-standalone-tutorial).
{% /callout %}

## Nx CLI vs. Angular CLI

Nx evolved from being an extension of the Angular CLI to a [fully standalone CLI working with multiple frameworks](/getting-started/why-nx#how-does-nx-work). As a result, adopting Nx as an Angular user is relatively straightforward. Your existing code, including builders and schematics, will still work as before, but you'll also have access to all the benefits Nx offers.

Advantages of Nx over the Angular CLI:

- [Cache any target](/features/cache-task-results)
- [Run only tasks affected by a code change](/ci/features/affected)
- [Split a large angular.json into multiple project.json files](/nx-api/angular/documents/nx-and-angular#projectjson-vs-angularjson)
- [Integrate with modern tools](/nx-api/angular/documents/nx-and-angular#integrating-with-modern-tools)
- [Controllable update process](/nx-api/angular/documents/nx-and-angular#ng-update-vs-nx-migrate)

Visit our ["Nx and the Angular CLI" page](/nx-api/angular/documents/nx-and-angular) for more details.

## Final Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/angular-monorepo" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/angular-standalone?file=README.md" /%} -->

<!-- {% youtube
src="https://www.youtube.com/embed/OQ-Zc5tcxJE"
title="Tutorial: Standalone Angular Application"
/%} -->

## Creating a new Angular Monorepo

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=64" /%} -->

Create a new Angular monorepo with the following command:

```{% command="npx create-nx-workspace@latest angular-monorepo --preset=angular-monorepo" path="~" %}

NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Application name · angular-store
✔ Which bundler would you like to use? · esbuild
✔ Default stylesheet format · css
✔ Do you want to enable Server-Side Rendering (SSR) and Static Site Generation (SSG/Prerendering)? · No
✔ Test runner to use for end to end (E2E) tests · cypress
✔ Do you want Nx Cloud to make your CI fast? · Yes
```

Let's name the initial application `angular-store`. In this tutorial we're going to use `cypress` for e2e tests and `css` for styling. The above command generates the following structure:

```
└─ angular-monorepo
   ├─ ...
   ├─ apps
   │  ├─ angular-store
   │  │  ├─ src
   │  │  │  ├─ app
   │  │  │  │  ├─ app.component.css
   │  │  │  │  ├─ app.component.html
   │  │  │  │  ├─ app.component.spec.ts
   │  │  │  │  ├─ app.component.ts
   │  │  │  │  ├─ app.config.ts
   │  │  │  │  ├─ app.routes.ts
   │  │  │  │  └─ nx-welcome.component.ts
   │  │  │  ├─ assets
   │  │  │  ├─ index.html
   │  │  │  ├─ main.ts
   │  │  │  ├─ styles.css
   │  │  │  └─ test-setup.ts
   │  │  ├─ eslintrc.json
   │  │  ├─ jest.config.ts
   │  │  ├─ project.json
   │  │  ├─ tsconfig.app.json
   │  │  ├─ tsconfig.editor.json
   │  │  ├─ tsconfig.json
   │  │  └─ tsconfig.spec.json
   │  └─ angular-store-e2e
   │     └─ ...
   ├─ nx.json
   ├─ tsconfig.base.json
   └─ package.json
```

The setup includes:

- a new Angular application (`apps/angular-store/`)
- a Cypress based set of e2e tests (`apps/angular-store-e2e/`)
- Prettier preconfigured
- ESLint preconfigured
- Jest preconfigured

Typically, an integrated Nx workspace places application projects in the `apps` folder and library projects in the `libs` folder. Applications are encouraged to be as light-weight as possible so that more code is pushed into libraries and can be reused in other projects. This folder structure is just a suggestion and can be modified to suit your organization's needs.

The [`nx.json` file](/reference/nx-json) contains configuration settings for Nx itself and global default settings that individual projects inherit. The `apps/angular-store/project.json` file contains [settings that are specific to the `angular-store` project](/reference/project-configuration). We'll examine that file more in the next section.

## Serving the App

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=207" /%} -->

To serve your new Angular application, just run:

```shell
nx serve angular-store
```

Your application should be served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Manually Defined Tasks

The project tasks are defined in the `project.json` file.

```json {% fileName="apps/angular-store/project.json"}
{
  "name": "angular-store",
  ...
  "targets": {
    "build": { ... },
    "serve": { ... },
    "extract-i18n": { ... },
    "lint": { ... },
    "test": { ... },
    "serve-static": { ... },
  },
}
```

Each target contains a configuration object that tells Nx how to run that target.

```json {% fileName="project.json"}
{
  "name": "angular-store",
  ...
  "targets": {
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "defaultConfiguration": "development",
      "options": {
        "buildTarget": "angular-store:build"
      },
      "configurations": {
        "development": {
          "buildTarget": "angular-store:build:development",
          "hmr": true
        },
        "production": {
          "buildTarget": "angular-store:build:production",
          "hmr": false
        }
      }
     },
     ...
  },
}
```

The most critical parts are:

- `executor` - this is of the syntax `<plugin>:<executor-name>`, where the `plugin` is an NPM package containing an [Nx Plugin](/extending-nx/intro/getting-started) and `<executor-name>` points to a function that runs the task.
- `options` - these are additional properties and flags passed to the executor function to customize it

Learn more about how to [run tasks with Nx](/features/run-tasks). We'll [revisit running tasks](#testing-and-linting) later in this tutorial.

## Adding Another Application

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=706" /%} -->

Nx plugins usually provide [generators](/features/generate-code) that allow you to easily scaffold code, configuration or entire projects. To see what capabilities the `@nx/angular` plugin provides, run the following command and inspect the output:

```{% command="npx nx list @nx/angular" path="angular-monorepo" %}

NX   Capabilities in @nx/angular:

   GENERATORS

   add-linting : Adds linting configuration to an Angular project.
   application : Creates an Angular application.
   component : Generate an Angular Component.
   component-cypress-spec : Creates a Cypress spec for a UI component that has a story.
   component-story : Creates a stories.ts file for a component.
   component-test : Creates a cypress component test file for a component.
   convert-tslint-to-eslint : Converts a project from TSLint to ESLint.
   init : Initializes the `@nrwl/angular` plugin.
   library : Creates an Angular library.
   library-secondary-entry-point : Creates a secondary entry point for an Angular publishable library.
   remote : Generate a Remote Angular Module Federation Application.
   move : Moves an Angular application or library to another folder within the workspace and updates the project configuration.
   // etc...

   EXECUTORS/BUILDERS

   delegate-build : Delegates the build to a different target while supporting incremental builds.
   ng-packagr-lite : Builds a library with support for incremental builds.
This executor is meant to be used with buildable libraries in an incremental build scenario. It is similar to the `@nrwl/angular:package` executor but with some key differences:
- It doesn't run `ngcc` automatically (`ngcc` needs to be run separately beforehand if needed, this can be done in a `postinstall` hook on `package.json`).
- It only produces ESM2020 bundles.
- It doesn't generate package exports in the `package.json`.
   package : Builds and packages an Angular library producing an output following the Angular Package Format (APF) to be distributed as an NPM package.
This executor is similar to the `@angular-devkit/build-angular:ng-packagr` with additional support for incremental builds.
   // etc...
```

{% callout type="info" title="Prefer a more visual UI?" %}

If you prefer a more integrated experience, you can install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the integrate with editors article](/getting-started/editor-setup).

{% /callout %}

Run the following command to generate a new `inventory` application. Note how we append `--dry-run` to first check the output.

```{% command="npx nx g @nx/angular:app inventory --directory=apps/inventory --dry-run" path="angular-monorepo" %}
NX  Generating @nx/angular:application

✔ Would you like to configure routing for this application? (y/N) · false
✔ Would you like to use Standalone Components? (y/N) · true
CREATE apps/inventory/project.json
CREATE apps/inventory/src/assets/.gitkeep
CREATE apps/inventory/src/favicon.ico
CREATE apps/inventory/src/index.html
CREATE apps/inventory/src/styles.css
CREATE apps/inventory/tsconfig.app.json
CREATE apps/inventory/tsconfig.editor.json
CREATE apps/inventory/tsconfig.json
CREATE apps/inventory/src/app/app.component.css
CREATE apps/inventory/src/app/app.component.html
CREATE apps/inventory/src/app/app.component.spec.ts
CREATE apps/inventory/src/app/app.component.ts
CREATE apps/inventory/src/app/app.config.ts
CREATE apps/inventory/src/app/nx-welcome.component.ts
CREATE apps/inventory/src/main.ts
CREATE apps/inventory/.eslintrc.json
CREATE apps/inventory/jest.config.ts
CREATE apps/inventory/src/test-setup.ts
CREATE apps/inventory/tsconfig.spec.json
CREATE apps/inventory-e2e/cypress.config.ts
CREATE apps/inventory-e2e/src/e2e/app.cy.ts
CREATE apps/inventory-e2e/src/fixtures/example.json
CREATE apps/inventory-e2e/src/support/app.po.ts
CREATE apps/inventory-e2e/src/support/commands.ts
CREATE apps/inventory-e2e/src/support/e2e.ts
CREATE apps/inventory-e2e/tsconfig.json
CREATE apps/inventory-e2e/project.json
CREATE apps/inventory-e2e/.eslintrc.json

NOTE: The "dryRun" flag means no changes were made.
```

As you can see, it generates a new application in the `apps/inventory/` folder. Let's actually run the generator by removing the `--dry-run` flag.

```shell
npx nx g @nx/angular:app inventory --directory=apps/inventory
```

## Sharing Code with Local Libraries

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=986" /%} -->

When you develop your Angular application, usually all your logic sits in the `app` folder. Ideally separated by various folder names which represent your "domains". As your app grows, however, the app becomes more and more monolithic and the code is unable to be shared with other applications.

```
└─ angular-monorepo
   ├─ ...
   ├─ apps
   │  └─ angular-store
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

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for each of these areas using the Angular library generator:

```
nx g @nx/angular:library products --directory=libs/products --standalone
nx g @nx/angular:library orders --directory=libs/orders --standalone
nx g @nx/angular:library shared-ui --directory=libs/shared/ui --standalone
```

Note how we type out the full path in the `directory` flag to place the libraries into a subfolder. You can choose whatever folder structure you like to organize your projects. If you change your mind later, you can run the [move generator](/nx-api/workspace/generators/move) to move a project to a different folder.

Running the above commands should lead to the following directory structure:

```
└─ angular-monorepo
   ├─ ...
   ├─ apps
   ├─ libs
   │  ├─ products
   │  │  ├─ ...
   │  │  ├─ project.json
   │  │  ├─ src
   │  │  │  ├─ index.ts
   │  │  │  ├─ test-setup.ts
   │  │  │  └─ lib
   │  │  │     └─ products
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

- has its own `project.json` file with corresponding targets you can run (e.g. running tests for just orders: `nx test orders`)
- has the name you specified in the generate command; you can find the name in the corresponding `project.json` file
- has a dedicated `index.ts` file which is the "public API" of the library
- is mapped in the `tsconfig.base.json` at the root of the workspace

### Importing Libraries into the Angular Applications

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=1245" /%} -->

All libraries that we generate automatically have aliases created in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@angular-monorepo/orders": ["libs/orders/src/index.ts"],
      "@angular-monorepo/products": ["libs/products/src/index.ts"],
      "@angular-monorepo/shared-ui": ["libs/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence we can easily import them into other libraries and our Angular application. As an example, let's create and expose a `ProductListComponent` component from our `libs/products` library. Either create it by hand or run

```shell
nx g @nx/angular:component product-list --directory=libs/products/src/lib/product-list --standalone --export
```

We don't need to implement anything fancy as we just want to learn how to import it into our main Angular application.

```html {% fileName="libs/products/src/lib/product-list/product-list.component.html" %}
<p>product-list works!</p>
```

Make sure the `ProductListComponent` is exported via the `index.ts` file of our `products` library and is listed in the `exports` of the `ProductsModule`. This is our public API with the rest of the workspace. Only export what's really necessary to be usable outside the library itself.

```ts {% fileName="libs/products/src/index.ts" %}
export * from './lib/products/products.component';

export * from './lib/product-list/product-list.component';
```

We're ready to import it into our main application now. First (if you haven't already), let's set up the Angular router. Configure it in the `app.config.ts`.

```ts {% fileName="apps/angular-store/src/app/app.config.ts" highlightLines=[2,3,4,5,6,9] %}
import { ApplicationConfig } from '@angular/core';
import {
  provideRouter,
  withEnabledBlockingInitialNavigation,
} from '@angular/router';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(appRoutes, withEnabledBlockingInitialNavigation())],
};
```

And in `app.component.html`:

```ts {% fileName="apps/angular-store/src/app/app.component.html" %}
<router-outlet></router-outlet>
```

Then we can add the `ProductListComponent` component to our `app.routes.ts` and render it via the routing mechanism whenever a user hits the `/products` route.

```ts {% fileName="apps/angular-store/src/app/app.routes.ts" highlightLines=[10,11,12,13,14] %}
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
      import('@angular-monorepo/products').then((m) => m.ProductListComponent),
  },
];
```

Serving your app (`nx serve angular-store`) and then navigating to `/products` should give you the following result:

![products route](/shared/tutorials/app-products-route.png)

Let's apply the same for our `orders` library.

- generate a new component `OrderListComponent` in `libs/orders` and export it in the corresponding `index.ts` file
- import it into the `app.routes.ts` and render it via the routing mechanism whenever a user hits the `/orders` route

In the end, your `app.routes.ts` should look similar to this:

```ts {% fileName="apps/angular-store/src/app/app.routes.ts" highlightLines=[15,16,17,18,19] %}
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
      import('@angular-monorepo/products').then((m) => m.ProductListComponent),
  },
  {
    path: 'orders',
    loadComponent: () =>
      import('@angular-monorepo/orders').then((m) => m.OrderListComponent),
  },
];
```

Let's also show products in the `inventory` app.

```ts {% fileName="apps/inventory/src/app/app.component.ts" highlightLines=[2,6] %}
import { Component } from '@angular/core';
import { ProductListComponent } from '@angular-monorepo/products';

@Component({
  standalone: true,
  imports: [ProductListComponent],
  selector: 'angular-monorepo-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'inventory';
}
```

```ts {% fileName="apps/inventory/src/app/app.component.html" %}
<angular-monorepo-product-list></angular-monorepo-product-list>
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
      "name": "angular-store",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "angular-store-e2e",
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
    "angular-store": [
      { "source": "angular-store", "target": "orders", "type": "static" },
      { "source": "angular-store", "target": "products", "type": "static" }
    ],
    "angular-store-e2e": [
      {
        "source": "angular-store-e2e",
        "target": "angular-store",
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

## Testing and Linting

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=410" /%} -->

Our current setup not only has targets for serving and building the Angular application, but also has targets for unit testing, e2e testing and linting. The `test` and `lint` targets are defined in the application `project.json` file, while the `e2e` target is [inferred from the `apps/angular-store-e2e/cypress.config.ts` file](#inferred-tasks). We can use the same syntax as before to run these tasks:

```bash
nx test angular-store # runs the tests for angular-store
nx lint inventory # runs the linter on inventory
nx e2e angular-store-e2e # runs e2e tests for the angular-store
```

### Inferred Tasks

Nx identifies available tasks for your project from [tooling configuration files](/concepts/inferred-tasks), `package.json` scripts and the targets defined in `project.json`. All tasks from the `angular-store` project are defined in its `project.json` file, but the companion `angular-store-e2e` project has its tasks inferred from configuration files. To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup), [Project Details View](/recipes/nx-console/console-project-details) or run:

```shell
nx show project angular-store-e2e --web
```

{% project-details title="Project Details View" height="100px" %}

```json
{
  "project": {
    "name": "angular-store-e2e",
    "type": "e2e",
    "data": {
      "metadata": {
        "targetGroups": {
          "E2E (CI)": ["e2e-ci--src/e2e/app.cy.ts", "e2e-ci"]
        }
      },
      "name": "angular-store-e2e",
      "root": "apps/angular-store-e2e",
      "sourceRoot": "apps/angular-store-e2e/src",
      "projectType": "application",
      "tags": [],
      "implicitDependencies": ["angular-store"],
      "targets": {
        "e2e": {
          "options": {
            "cwd": "apps/angular-store-e2e",
            "command": "cypress run"
          },
          "cache": true,
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["cypress"]
            }
          ],
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/screenshots"
          ],
          "configurations": {
            "production": {
              "command": "cypress run --env webServerCommand=\"nx run angular-store:serve:production\""
            }
          },
          "executor": "nx:run-commands",
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "e2e-ci--src/e2e/app.cy.ts": {
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/screenshots"
          ],
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["cypress"]
            }
          ],
          "cache": true,
          "options": {
            "cwd": "apps/angular-store-e2e",
            "command": "cypress run --env webServerCommand=\"nx run angular-store:serve-static\" --spec src/e2e/app.cy.ts"
          },
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "e2e-ci": {
          "executor": "nx:noop",
          "cache": true,
          "inputs": [
            "default",
            "^production",
            {
              "externalDependencies": ["cypress"]
            }
          ],
          "outputs": [
            "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/videos",
            "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/screenshots"
          ],
          "dependsOn": [
            {
              "target": "e2e-ci--src/e2e/app.cy.ts",
              "projects": "self",
              "params": "forward"
            }
          ],
          "options": {},
          "configurations": {},
          "metadata": {
            "technologies": ["cypress"]
          }
        },
        "lint": {
          "cache": true,
          "options": {
            "cwd": "apps/angular-store-e2e",
            "command": "eslint ."
          },
          "inputs": [
            "default",
            "{workspaceRoot}/.eslintrc.json",
            "{workspaceRoot}/apps/angular-store-e2e/.eslintrc.json",
            "{workspaceRoot}/tools/eslint-rules/**/*",
            {
              "externalDependencies": ["eslint"]
            }
          ],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["eslint"]
          }
        }
      }
    }
  },
  "sourceMap": {
    "targets": ["apps/angular-store-e2e/project.json", "nx/core/project-json"],
    "targets.e2e": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.cache": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.inputs": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.outputs": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.options": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e.configurations": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.cache": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.inputs": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.outputs": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci--src/e2e/app.cy.ts.options": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.cache": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.dependsOn": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.inputs": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.outputs": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.e2e-ci.executor": [
      "apps/angular-store-e2e/cypress.config.ts",
      "@nx/cypress/plugin"
    ],
    "targets.lint": [
      "apps/angular-store-e2e/project.json",
      "@nx/eslint/plugin"
    ],
    "targets.lint.cache": [
      "apps/angular-store-e2e/project.json",
      "@nx/eslint/plugin"
    ],
    "targets.lint.inputs": [
      "apps/angular-store-e2e/project.json",
      "@nx/eslint/plugin"
    ],
    "targets.lint.options": [
      "apps/angular-store-e2e/project.json",
      "@nx/eslint/plugin"
    ]
  }
}
```

{% /project-details %}

If you expand the `e2e` task, you can see that it was created by the `@nx/cypress` plugin by analyzing the `apps/angular-store-e2e/cypress.config.ts` file. Notice the outputs are defined as:

```json
[
  [
    "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/videos",
    "{workspaceRoot}/dist/cypress/apps/angular-store-e2e/screenshots"
  ]
]
```

This value is being read from the `videosFolder` and `screenshotsFolder` defined by the `nxE2EPreset` in your `apps/angular-store-e2e/cypress.config.ts` file. Let's change their value in your `apps/angular-store-e2e/cypress.config.ts` file:

```ts {% fileName="apps/angular-store-e2e/cypress.config.ts" highlightLines=["8-10"] %}
// ...
export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      // ...
    }),
    baseUrl: 'http://localhost:4200',
    videosFolder: '../dist/cypress/apps/angular-store-e2e/videos-changed',
    screenshotsFolder:
      '../dist/cypress/apps/angular-store-e2e/screenshots-changed',
  },
});
```

Now if you look at the project details view again, the outputs for the `e2e` target will be:

```json
[
  "{workspaceRoot}/apps/dist/cypress/apps/angular-store-e2e/videos-changed",
  "{workspaceRoot}/apps/dist/cypress/apps/angular-store-e2e/screenshots-changed"
]
```

This feature ensures that Nx will always cache the correct files.

You can also override the settings for inferred tasks by modifying the [`targetDefaults` in `nx.json`](/reference/nx-json#target-defaults) or setting a value in your [`project.json` file](/reference/project-configuration). Nx will merge the values from the inferred tasks with the values you define in `targetDefaults` and in your specific project's configuration.

### Running Multiple Tasks

In addition to running individual tasks, you can also run multiple tasks in parallel using the following syntax:

```shell
nx run-many -t test lint e2e
```

### Caching

One thing to highlight is that Nx is able to [cache the tasks you run](/features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="nx run-many -t test lint e2e" path="angular-monorepo" %}
✔  nx run e2e:lint  [existing outputs match the cache, left as is]
✔  nx run angular-store:lint  [existing outputs match the cache, left as is]
✔  nx run angular-store:test  [existing outputs match the cache, left as is]
✔  nx run e2e:e2e  [existing outputs match the cache, left as is]

——————————————————————————————————————————————————————

NX   Successfully ran targets test, lint, e2e for 5 projects (54ms)

Nx read the output from the cache instead of running the command for 10 out of 10 tasks.
```

Not all tasks might be cacheable though. You can [configure which tasks are cacheable](/features/cache-task-results) in [the project configuration](/reference/project-configuration#cache) or in [the global Nx configuration](/reference/nx-json#cache). You can also [learn more about how caching works](/concepts/how-caching-works).

### Testing Affected Projects

Commit your changes to git.

```shell
git commit -a -m "some commit message"
```

And then make a small change to the `products` library.

```html {% fileName="libs/products/src/lib/product-list/product-list.component.html" %}
<p>product-list works!</p>
<p>This is a change. 👋</p>
```

One of the key features of Nx in a monorepo setting is that you're able to run tasks only for projects that are actually affected by the code changes that you've made. To run the tests for only the projects affected by this change, run:

```shell
nx affected -t test
```

Note that the unit tests were run for `products`, `angular-store` and `inventory`, but not for `orders` because a change to `products` can not possibly break the tests for `orders`. In a small repo like this, there isn't a lot of time saved, but as there are more tests and more projects, this quickly becomes an essential command.

You can also see what projects are affected in the graph visualizer with;

```shell
nx graph --affected
```

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "angular-store",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "angular-store-e2e",
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
    "angular-store": [
      { "source": "angular-store", "target": "orders", "type": "static" },
      { "source": "angular-store", "target": "products", "type": "static" }
    ],
    "angular-store-e2e": [
      {
        "source": "angular-store-e2e",
        "target": "angular-store",
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
    "angular-store",
    "angular-store-e2e"
  ],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

## Building the Apps for Deployment

<!-- {% video-link link="https://youtu.be/OQ-Zc5tcxJE?t=856" /%} -->

If you're ready and want to ship your applications, you can build them using

```{% command="npx nx run-many -t build" path="angular-monorepo" %}
NX  Generating @nx/angular:component

CREATE libs/orders/src/lib/order-list/order-list.component.css
CREATE libs/orders/src/lib/order-list/order-list.component.html
CREATE libs/orders/src/lib/order-list/order-list.component.spec.ts
CREATE libs/orders/src/lib/order-list/order-list.component.ts
UPDATE libs/orders/src/index.ts
❯ nx run-many -t build

✔  nx run inventory:build:production (7s)
✔  nx run angular-store:build:production (7s)

———————————————————————————————————————————————————————————————————————

NX   Successfully ran target build for 2 projects (7s)
```

All the required files will be placed in `dist/apps/angular-store` and `dist/apps/inventory` and can be deployed to your favorite hosting provider.

You can even create your own `deploy` task that sends the build output to your hosting provider.

```json {% fileName="apps/angular-store/project.json" %}
{
  "targets": {
    "deploy": {
      "dependsOn": "build",
      "command": "netlify deploy --dir=dist/angular-store"
    }
  }
}
```

Replace the `command` with whatever terminal command you use to deploy your site.

The `"dependsOn": "build"` setting tells Nx to make sure that the project's `build` task has been run successfully before the `deploy` task.

With the `deploy` tasks defined, you can deploy a single application with `nx deploy angular-store` or deploy any applications affected by the current changes with:

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
  "tags": ["type:feature", "scope:orders"],
}
```

Then go to the `project.json` of your `products` library and assign the tags `type:feature` and `scope:products` to it.

```json {% fileName="libs/products/project.json" %}
{
  ...
  "tags": ["type:feature", "scope:products"],
}
```

Finally, go to the `project.json` of the `shared-ui` library and assign the tags `type:ui` and `scope:shared` to it.

```json {% fileName="libs/shared/ui/project.json" %}
{
  ...
  "tags": ["type:ui", "scope:shared"],
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

To test it, go to your `libs/products/src/lib/product-list/product-list.component.ts` file and import the `OrderListComponent` from the `orders` project:

```ts {% fileName="libs/products/src/lib/product-list/product-list.component.ts" highlightLines=[4,5] %}
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// This import is not allowed 👇
import { OrderListComponent } from '@angular-monorepo/orders';

@Component({
  selector: 'angular-monorepo-product-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
})
export class ProductListComponent {}
```

If you lint your workspace you'll get an error now:

```{% command="nx run-many -t lint" %}
NX   Running target lint for 7 projects
✖  nx run products:lint
   Linting "products"...

   /Users/isaac/Documents/code/nx-recipes/angular-monorepo/libs/products/src/lib/product-list/product-list.component.ts
     5:1   error    A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries
     5:10  warning  'OrderListComponent' is defined but never used                                                               @typescript-eslint/no-unused-vars

   ✖ 2 problems (1 error, 1 warning)

   Lint warnings found in the listed files.

   Lint errors found in the listed files.


✔  nx run orders:lint (1s)
✔  nx run angular-store:lint (1s)
✔  nx run angular-store-e2e:lint (689ms)
✔  nx run inventory-e2e:lint (690ms)
✔  nx run inventory:lint (858ms)
✔  nx run shared-ui:lint (769ms)

———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Ran target lint for 7 projects (3s)

✔  6/7 succeeded [0 read from cache]

✖  1/7 targets failed, including the following:
   - nx run products:lint
```

If you have the ESLint plugin installed in your IDE you should immediately see an error:

![ESLint module boundary error](/shared/tutorials/module-boundary-lint-rule.png)

Learn more about how to [enforce module boundaries](/features/enforce-module-boundaries).

## Set Up CI for Your Angular Monorepo

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

- Read more about [how Nx compares to the Angular CLI](/nx-api/angular/documents/nx-and-angular)
- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn about popular generators such as [how to setup Tailwind](/recipes/angular/using-tailwind-css-with-angular-projects)
- Learn how to [migrate your existing Angular CLI repo to Nx](/recipes/angular/migration/angular)
- [Setup Storybook for our shared UI library](/recipes/storybook/overview-angular)

Also, make sure you

- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](https://blog.nrwl.io/)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
