---
title: 'React App Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building a Single React App with Nx

In this tutorial you'll learn how to use React with Nx in a ["standalone" (non-monorepo) setup](/concepts/integrated-vs-package-based#standalone-applications).

What are you going to learn?

- how to add Nx to a React and Vite project
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to leverage code generators to scaffold components
- how to modularize your codebase and impose architectural constraints for better maintainability

{% callout type="info" title="Looking for React monorepos?" %}
Note, this tutorial sets up a repo with a single application at the root level that breaks out its code into libraries to add structure. If you are looking for a React monorepo setup then check out our [React monorepo tutorial](/getting-started/tutorials/react-monorepo-tutorial).
{% /callout %}

We're going to start with a default React application and progressively add the core of Nx, then use the `@nx/react` plugin. [Visit our "Why Nx" page](/getting-started/why-nx) to learn more about plugins and what role they play in the Nx architecture.

## Final Code

Here's the source code of the final result for this tutorial.

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/react-app" /%}

<!-- {% stackblitz-button url="github.com/nrwl/nx-recipes/tree/main/react-standalone?file=README.md" /%} -->

## Creating a new React App

Create a new React application that uses Vite with the following command:

```{% command="npm create vite react-app -- --template=react-ts" path="~" %}

Scaffolding project in ~/react-app...

Done. Now run:

  cd react-app
  npm install
  npm run dev
```

Once you have run `npm install`, set up Git with the following commands:

```shell
git init
git add .
git commit -m "initial commit"
```

Your repository should now have the following structure:

```
└─ react-app
   ├─ ...
   ├─ public
   │  └─ ...
   ├─ src
   │  ├─ assets
   │  ├─ App.css
   │  ├─ App.tsx
   │  ├─ index.css
   │  └─ main.tsx
   ├─ .eslintrc.cjs
   ├─ index.html
   ├─ package.json
   ├─ README.md
   ├─ tsconfig.json
   ├─ tsconfig.node.json
   └─ vite.config.ts
```

The setup includes..

- a new React application at the root of the repository (`src`)
- ESLint preconfigured
- Vite preconfigured

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

```shell {% path="~/react-app" %}
npx nx@latest init
```

This command will download the latest version of Nx and help set up your repository to take advantage of it.

First, the script will propose installing some plugins based on the packages that are being used in your repository.

- Leave the plugins deselected so that we can explore what Nx provides without any plugins.

Second, the script asks a series of questions to help set up caching for you.

- `Which scripts are cacheable?` - Choose `build` and `lint`
- `Does the "build" script create any outputs?` - Enter `dist`
- `Does the "lint" script create any outputs?` - Enter nothing
- `Would you like remote caching to make your build faster?` - Choose `Skip for now`

We'll enable Nx Cloud and set up remote caching later in the tutorial.

## Caching Pre-configured

Nx has been configured to run your npm scripts as Nx tasks. You can run a single task like this:

```shell {% path="~/react-app" %}
npx nx build react-app
```

During the `init` script, Nx also configured caching for these tasks. You can see in the `nx.json` file that the `build` and `lint` targets have the `cache` property set to `true` and the `build` target specifies that its output goes to the project's `dist` folder.

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Try running `build` for the `react-app` app a second time:

```shell {% path="~/react-app" %}
npx nx build react-app
```

The first time `nx build` was run, it took about 2 seconds - just like running `npm run build`. But the second time you run `nx build`, it completes instantly and displays this message:

```text
Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

You can see the same caching behavior working when you run `npx nx lint`.

## Create a Task Pipeline

If you look at the `build` script in `package.json`, you'll notice that it is actually doing two things. First, it runs `tsc` to type check the application and then it uses Vite to build the application.

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "tsc && vite build"
  }
}
```

Let's split this into two separate tasks, so we can run `typecheck` without running the `build` task.

```json {% fileName="package.json" %}
{
  "scripts": {
    "typecheck": "tsc",
    "build": "vite build"
  }
}
```

But we also want to make sure that `typecheck` is always run when you run the `build` task. Nx can take care of this for you with a [task pipeline](/concepts/task-pipeline-configuration). The `dependsOn` property in `nx.json` can be used to ensure that all task dependencies are run first.

```json {% fileName="nx.json" highlightLines=[6] %}
{
  "targetDefaults": {
    "build": {
      "outputs": ["{projectRoot}/dist"],
      "cache": true,
      "dependsOn": ["typecheck"]
    },
    "lint": {
      "cache": true
    }
  }
}
```

{% callout type="info" title="Project-Specific Settings" %}

The `targetDefaults` in the `nx.json` file will apply to all the projects in your repository. If you want to specify these options for a specific project, you can set them under `nx.targets.build` in that project's `package.json` file.

{% /callout %}

Now if you run `nx build`, Nx will run `typecheck` first.

```text {% command="npx nx build" path="~/react-app" %}
> nx run react-app:typecheck


> react-app@0.0.0 typecheck
> tsc


> nx run react-app:build


> react-app@0.0.0 build
> vite build

vite v5.2.12 building for production...
✓ 34 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.30 kB
dist/assets/react-CHdo91hT.svg    4.13 kB │ gzip:  2.05 kB
dist/assets/index-DiwrgTda.css    1.39 kB │ gzip:  0.72 kB
dist/assets/index-DVoHNO1Y.js   143.36 kB │ gzip: 46.09 kB
✓ built in 347ms

——————————————————————————————————————————————————————

 NX   Successfully ran target build for project react-app and 1 task it depends on (2s)
```

We can also cache the `typecheck` task by updating the `nx.json` file.

```json {% fileName="nx.json" highlightLines=["4-6"] %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "typecheck": {
      "cache": true
    },
    "build": {
      "outputs": ["{projectRoot}/dist"],
      "cache": true,
      "dependsOn": ["typecheck"]
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Now, running `npx nx build` twice will once again complete instantly.

## Use Nx Plugins to Enhance Vite Tasks with Caching

You may remember that we defined the `outputs` property in `nx.json` when we were answering questions in the `nx init` script. The value is currently hard-coded so that if you change the output path in your `vite.config.ts`, you have to remember to also change the `outputs` array in the `build` task configuration. This is where plugins can help. Plugins enable better integration with specific tools. The `@nx/vite` plugin can understand the `vite.config.ts` file and automatically create and configure tasks based on the settings in that file.

Nx plugins can:

- automatically configure caching for you, including inputs and outputs based on the underlying tooling configuration
- create tasks for a project using the tooling configuration files
- provide code generators to help scaffold out projects
- automatically keep the tooling versions and configuration files up to date

For this tutorial, we'll just focus on the automatic caching configuration.

First, let's delete the `outputs` array from `nx.json` so that we don't override the inferred values from the plugin. Your `nx.json` should look like this:

```json {% fileName="nx.json" %}
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "typecheck": {
      "cache": true
    },
    "build": {
      "cache": true,
      "dependsOn": ["typecheck"]
    },
    "lint": {
      "cache": true
    }
  },
  "defaultBase": "main"
}
```

Now let's add the `@nx/vite` plugin:

```{% command="npx nx add @nx/vite" path="~/react-app" %}
✔ Installing @nx/vite...
✔ Initializing @nx/vite...

 NX   Package @nx/vite added successfully.
```

The `nx add` command installs the version of the plugin that matches your repo's Nx version and runs that plugin's initialization script. For `@nx/vite`, the initialization script registers the plugin in the `plugins` array of `nx.json` and updates any `package.json` scripts that execute Vite related tasks to run those tasks through Nx. Running the tasks through Nx is necessary for caching and task pipelines to work.

Open the project details view for the `demo` app and look at the `build` task. You can view the project details using [Nx Console](/getting-started/editor-setup) or by running the following command in the terminal:

```shell {% path="~/react-app" %}
npx nx show project react-app
```

{% project-details title="Project Details View" jsonFile="shared/tutorials/react-standalone-pdv.json" %}
{% /project-details %}

If you hover over the settings for the `build` task, you can see where those settings come from. The `inputs` and `outputs` are defined by the `@nx/vite` plugin from the `vite.config.ts` file where as the `dependsOn` property we set earlier in the tutorial in the `targetDefaults` in the `nx.json` file.

Now let's change where the `build` results are output to in the `vite.config.ts` file.

```{% fileName="vite.config.ts" highlightLines=["7-9"] %}
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/react-app',
  },
});
```

Now if you look at project details view again, you'll see that the `outputs` property for Nx's caching has been updated to stay in sync with the setting in the `vite.config.ts` file.

## Creating New Components

You can just create new React components as you normally would. However, Nx plugins also ship [generators](/features/generate-code). They allow you to easily scaffold code, configuration or entire projects. Let's add the `@nx/react` plugin to take advantage of the generators it provides.

```shell
npx nx add @nx/react
```

To see what capabilities the `@nx/react` plugin ships, run the following command and inspect the output:

```text {% command="npx nx list @nx/react" path="react-app" %}
 NX   Capabilities in @nx/react:

GENERATORS

init : Initialize the `@nx/react` plugin.
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

{% callout type="info" title="Integrate with Your Editor" %}

For a more integrated experience, install the "Nx Console" extension for your code editor. It has support for VSCode, IntelliJ and ships a LSP for Vim. Nx Console provides autocompletion support in Nx configuration files and has UIs for browsing and running generators.

More info can be found in [the integrate with editors article](/getting-started/editor-setup).

{% /callout %}

Run the following command to generate a new "hello-world" component. Note how we append `--dry-run` to first check the output.

```text {% command="npx nx g @nx/react:component --directory=src/app/hello-world --skipTests=true hello-world --dry-run" path="react-app" %}
NX  Generating @nx/react:component

✔ Which stylesheet format would you like to use? · css
✔ Should this component be exported in the project? (y/N) · false
✔ Where should the component be generated? · src/app/hello-world/hello-world.tsx
CREATE src/app/hello-world/hello-world.module.css
CREATE src/app/hello-world/hello-world.tsx

NOTE: The "dryRun" flag means no changes were made.
```

As you can see it generates a new component in the `src/app/hello-world/` folder. If you want to actually run the generator, remove the `--dry-run` flag.

The `hello-world` component will look like this:

```tsx {% fileName="src/app/hello-world/hello-world.tsx" highlightLines=[6] %}
import styles from './hello-world.module.css';

export function HelloWorld() {
  return (
    <div className={styles['container']}>
      <h1>Welcome to HelloWorld!</h1>
    </div>
  );
}

export default HelloWorld;
```

Let's update the `App.tsx` file to use the new `HelloWorld` component:

```tsx {% fileName="src/App.tsx" %}
import './App.css';
import HelloWorld from './app/hello-world/hello-world';

function App() {
  return (
    <>
      <HelloWorld />
    </>
  );
}

export default App;
```

You can view your app with the `nx serve` command:

```shell
npx nx serve
```

## You're ready to go!

In the previous sections you learned about the basics of using Nx, running tasks and navigating an Nx workspace. You're ready to ship features now!

But there's more to learn. You have two possibilities here:

- [Jump to the next steps section](#next-steps) to find where to go from here or
- keep reading and learn some more about what makes Nx unique when working with React.

## Modularize your React App with Local Libraries

When you develop your React application, usually all your logic sits in the `src` folder. Ideally separated by various folder names which represent your "domains". As your app grows, this becomes more and more monolithic though.

```
└─ react-app
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

### Create a Local Library

Let's assume our domain areas include `products`, `orders` and some more generic design system components, called `ui`. We can generate a new library for these areas using the React library generator:

```
npx nx g @nx/react:library products --unitTestRunner=vitest --bundler=none --directory=modules/products
```

Note how we use the `--directory` flag to place the library into a subfolder. You can choose whatever folder structure you like to organize your libraries.

Nx sets up your workspace to work with the modular library architecture, but depending on your existing configuration, you may need to tweak some settings. In this repo, you'll need to make a small change in order to prepare for future steps.

#### Build Settings

To make sure that the build can correctly pull in code from libraries, we'll update `vite.config.ts` to account for typescript aliases. Run the following generator to automatically update your configuration file.

```shell
npx nx g @nx/vite:setup-paths-plugin
```

This will update the `vite.config.ts` file to include the `nxViteTsPaths` plugin in the `plugins` array.

```{% fileName="vite.config.ts" highlightLines=[3,7] %}
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nxViteTsPaths()],
  build: {
    outDir: 'dist/react-app',
  },
});
```

### Create More Libraries

Now that the build system is set up, let's generate the `orders` and `ui` libraries.

```
nx g @nx/react:library orders --unitTestRunner=vitest --bundler=none --directory=modules/orders
nx g @nx/react:library ui --unitTestRunner=vitest --bundler=none --directory=modules/shared/ui
```

Running the above commands should lead to the following directory structure:

```
└─ react-app
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
      "orders": ["modules/orders/src/index.ts"],
      "products": ["modules/products/src/index.ts"],
      "ui": ["modules/shared/ui/src/index.ts"]
    },
    ...
  },
}
```

That way we can easily import them into other libraries and our React application. As an example, let's import the `Products` component from the `products` project into our main application. First (if you haven't already), let's set up React Router.

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

import App from './App';

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

Then we can import the `Products` component into our `app.tsx` and render it via the routing mechanism whenever a user hits the `/products` route.

```tsx {% fileName="src/App.tsx" %}
import './App.css';
import HelloWorld from './app/hello-world/hello-world';
import { Route, Routes } from 'react-router-dom';

// importing the component from the library
import { Products } from 'products';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HelloWorld />}></Route>
      <Route path="/products" element={<Products />}></Route>
    </Routes>
  );
}

export default App;
```

Serving your app (`nx serve`) and then navigating to `/products` should give you the following result:

![products route](/shared/tutorials/react-standalone-products-route.png)

Let's apply the same steps for our `orders` library. Import the `Orders` component into the `App.tsx` file and render it via the routing mechanism whenever a user hits the `/orders` route

In the end, your `App.tsx` should look similar to this:

```tsx {% fileName="src/App.tsx" %}
import './App.css';
import HelloWorld from './app/hello-world/hello-world';
import { Route, Routes } from 'react-router-dom';
import { Products } from 'products';
import { Orders } from 'orders';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HelloWorld />}></Route>
      <Route path="/products" element={<Products />}></Route>
      <Route path="/orders" element={<Orders />}></Route>
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
      "name": "react-app",
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
    "react-app": [
      { "source": "react-app", "target": "orders", "type": "static" },
      { "source": "react-app", "target": "products", "type": "static" }
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

Notice how `ui` is not yet connected to anything because we didn't import it in any of our projects.

Exercise for you: change the codebase such that `ui` is used by `orders` and `products`.

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

To enforce the rules, Nx ships with a custom ESLint rule.

### Lint Settings

We want the `lint` task for the root `react-app` project to only lint the files for that project (in the `src` folder), so we'll change the `lint` command in `package.json`:

```json {% fileName="package.json" %}
{
  "scripts": {
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

Install the `@nx/eslint-plugin` package. This is an ESLint plugin that can be used in the `plugins` property of your ESLint configuration. There is also an Nx plugin named `@nx/eslint` that was automatically installed with the `@nx/react` plugin that was added earlier in the tutorial.

```
npx nx add @nx/eslint-plugin
```

We need to update the `.eslintrc.cjs` file to extend the `.eslintrc.base.json` file and undo the `ignorePattern` from that config that ignores every file. The `.eslintrc.base.json` file serves as a common set of lint rules for every project in the repository.

```js {% fileName=".eslintrc.cjs" highlightLines=[11,"17-53"] %}
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    './.eslintrc.base.json',
  ],
  ignorePatterns: ['!**/*', 'dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
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

```tsx {% fileName="modules/products/src/lib/products.tsx" %}
import styles from './products.module.css';

// This import is not allowed 👇
import { Orders } from 'orders';

/* eslint-disable-next-line */
export interface ProductsProps {}

export function Products() {
  return (
    <div className={styles['container']}>
      <h1>Welcome to Products!</h1>
    </div>
  );
}

export default Products;
```

If you lint your workspace you'll get an error now:

```{% command="nx run-many -t lint" %}
✔  nx run orders:lint  [existing outputs match the cache, left as is]
✔  nx run ui:lint (1s)

✖  nx run products:lint
   Linting "products"...

   /Users/.../react-app/modules/products/src/lib/products.tsx
     3:1  error  A project tagged with "scope:products" can only depend on libs tagged with "scope:products", "scope:shared"  @nx/enforce-module-boundaries

   ✖ 1 problem (1 error, 0 warnings)

   Lint errors found in the listed files.

✔  nx run react-app:lint (1s)

————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

NX   Ran target lint for 4 projects (1s)

✔    3/4 succeeded [1 read from cache]

✖    1/4 targets failed, including the following:
     - nx run products:lint
```

If you have the ESLint plugin installed in your IDE you should also immediately see an error.

Learn more about how to [enforce module boundaries](/features/enforce-module-boundaries).

## Migrating to a Monorepo

When you are ready to add another application to the repo, you'll probably want to move `react-app` to its own folder. To do this, you can run the [`convert-to-monorepo` generator](/nx-api/workspace/generators/convert-to-monorepo) or [manually move the configuration files](/recipes/tips-n-tricks/standalone-to-integrated).

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
