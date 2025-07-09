---
title: 'React Monorepo Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building and Testing React Apps in Nx

In this tutorial, you'll learn how to create a new React monorepo using the Nx platform.

{% callout type="note" title="Prerequisites" %}
This tutorial requires a [GitHub account](https://github.com) to demonstrate the full value of **Nx**-including task running, caching, and CI integration.
{% /callout %}

What will you learn?

- how to create a new React workspace with [GitHub Actions](https://github.com/features/actions) preconfigured
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to modularize your codebase with local libraries for better code organization
- how to benefit from caching that works both locally and in CI
- how to set up self-healing CI to apply fixes directly from your local editor

## Creating a new React Monorepo

To get started, let's create a new React monorepo with Nx Cloud and GitHub Actions preconfigured.

{% call-to-action title="Create a new React monorepo" url="https://cloud.nx.app/create-nx-workspace" description="With Nx and GitHub Actions fully set up" /%}

When you are prompted to run `create-nx-workspace` locally, use `acme` as the workspace name, select the `react` preset, and select `none` as the framework. For the remaining options, you can use the following values:

```{% command="npx create-nx-workspace@latest --ci=github" path="~" %}

 NX   Let's create a new workspace [https://nx.dev/getting-started/intro]

✔ Where would you like to create your workspace? · acme
✔ Which stack do you want to use? · react
✔ What framework would you like to use? · none
✔ Application name · demo
✔ Would you like to use React Router for server-side rendering [https://reactrouter.com/]? · No
✔ Which bundler would you like to use? · vite
✔ Which unit test runner would you like to use? · vitest
✔ Test runner to use for end to end (E2E) tests · none
✔ Default stylesheet format · css
✔ Would you like to use ESLint? · Yes
✔ Would you like to use Prettier for code formatting? · Yes
```

You should now have a new workspace called `acme` with Vite, Vitest, ESLint, and Prettier preconfigured.

```
acme
├── .github
│   └── workflows
│       └── ci.yml
├── apps
│   └── demo
├── README.md
├── eslint.config.mjs
├── nx.json
├── package-lock.json
├── package.json
├── tsconfig.base.json
├── tsconfig.json
└── vitest.workspace.ts
```

The `.github/workflows/ci.yml` file preconfigures your CI in GitHub Actions to run build and test through Nx.

The `demo` app is created under the `apps` directory as a convention. Later in this tutorial we'll create libraries under the `packages` folder. In practice, you can choose any folder structure you like.

The [`nx.json` file](/reference/nx-json) contains configuration settings for Nx itself and global default settings that individual projects inherit.

Before continuing, it is **important** to make sure that your GitHub repository is [connected to your Nx Cloud organizatino](https://cloud.nx.app/setup) to enable remote caching and self-healing in CI.

![](/shared/images/tutorials/connected-workspace.png)

Now, let's build some features and see how Nx helps get us to production faster.

## Serving the App

To serve your new React app, run:

```shell
npx nx serve demo
```

The app is served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Inferred Tasks

Nx identifies available tasks for your project from [tooling configuration files](/concepts/inferred-tasks) such as `package.json` scripts and `vite.config.ts`. To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

```shell
npx nx show project demo
```

{% project-details title="Project Details View (Simplified)" %}

```json
{
  "project": {
    "name": "@acme/demo",
    "type": "app",
    "data": {
      "root": "apps/demo",
      "targets": {
        "build": {
          "options": {
            "cwd": "apps/demo",
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
          "outputs": ["{workspaceRoot}/dist/apps/demo"],
          "executor": "nx:run-commands",
          "configurations": {}
        }
      },
      "name": "demo",
      "$schema": "../../node_modules/nx/schemas/project-schema.json",
      "sourceRoot": "apps/demo/src",
      "projectType": "application",
      "tags": [],
      "implicitDependencies": []
    }
  },
  "sourceMap": {
    "root": ["apps/demo/project.json", "nx/core/project-json"],
    "targets": ["apps/demo/project.json", "nx/core/project-json"],
    "targets.build": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.command": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.cache": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.dependsOn": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.inputs": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.outputs": ["apps/demo/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options.cwd": [
      "apps/demo/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "name": ["apps/demo/project.json", "nx/core/project-json"],
    "$schema": ["apps/demo/project.json", "nx/core/project-json"],
    "sourceRoot": ["apps/demo/project.json", "nx/core/project-json"],
    "projectType": ["apps/demo/project.json", "nx/core/project-json"],
    "tags": ["apps/demo/project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

If you expand the `build` task, you can see that it was created by the `@nx/vite` plugin by analyzing your `vite.config.ts` file. Notice the outputs are defined as `{projectRoot}/dist`. This value is being read from the `build.outDir` defined in your `vite.config.ts` file. Let's change that value in your `vite.config.ts` file:

```ts {% fileName="apps/demo/vite.config.ts" %}
export default defineConfig({
  // ...
  build: {
    outDir: './build',
    // ...
  },
});
```

Now if you look at the project details view, the outputs for the build target will say `{projectRoot}/build`. The `@nx/vite` plugin ensures that tasks and their options, such as outputs, are automatically and correctly configured.

{% callout type="note" title="Overriding inferred task options" %}
You can override the options for inferred tasks by modifying the [`targetDefaults` in `nx.json`](/reference/nx-json#target-defaults) or setting a value in your [`package.json` file](/reference/project-configuration). Nx will merge the values from the inferred tasks with the values you define in `targetDefaults` and in your specific project's configuration.
{% /callout %}

## Modularization with Local Libraries

When you develop your React application, usually all your logic sits in the app's `src` folder. Ideally separated by various folder names which represent your domains or features. As your app grows, however, the app becomes more and more monolithic, which makes building and testing it harder and slower.

```
acme
├── apps
│   └── demo
│        └── src
│            ├── app
│            ├── cart
│            ├── products
│            ├── orders
│            └── ui
└── ...
```

Nx allows you to separate this logic into "local libraries." The main benefits include

- better separation of concerns
- better reusability
- more explicit private and public boundaries (APIs) between domains and features
- better scalability in CI by enabling independent test/lint/build commands for each library
- better scalability in your teams by allowing different teams to work on separate libraries

### Create Local Libraries

Let's create a reusable design system library called `ui` that we can use across our workspace. This library will contain reusable components such as buttons, inputs, and other UI elements.

```
npx nx g @nx/react:library packages/ui --unitTestRunner=vitest --bundler=none
```

Note how we type out the full path in the `directory` flag to place the library into a subfolder. You can choose whatever folder structure you like to organize your projects.

Running the above commands should lead to the following directory structure:

```
acme
├── apps
│   └── demo
├── packages
│   └── ui
├── eslint.config.mjs
├── nx.json
├── package-lock.json
├── package.json
├── tsconfig.base.json
├── tsconfig.json
└── vitest.workspace.ts
```

Just as with the `demo` app, Nx automatically infers the tasks for the `ui` library from its configuration files. You can view them by running:

```shell
npx nx show project ui
```

In this case, we have the `lint` and `test` tasks available, among other inferred tasks.

```shell
npx nx lint ui
npx nx test ui
```

### Import Libraries into the Demo App

All libraries that we generate are automatically included in the `workspaces` defined in the root-level `package.json`.

```json {% fileName="package.json" %}
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Hence, we can easily import them into other libraries and our React application.

You can see that the `AcmeUi` component is exported via the `index.ts` file of our `ui` library so that other projects in the repository can use it. This is our public API with the rest of the workspace and is enforced by the `exports` field in the `package.json` file. Only export what's necessary to be usable outside the library itself.

```ts {% fileName="packages/ui/src/index.ts" %}
export * from './lib/ui';
```

Let's add a simple `Hero` component that we can use in our demo app.

```tsx {% fileName="packages/ui/src/lib/hero.tsx" %}
const styles = {
  hero: {
    backgroundColor: '#1a1a2e',
    color: 'white',
    padding: '100px 20px',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  subtitle: {
    fontSize: '20px',
    marginBottom: '32px',
  },
  button: {
    backgroundColor: '#0066ff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '18px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export function Hero(props: {
  title: string;
  subtitle: string;
  cta: string;
  onCtaClick?: () => void;
}) {
  return (
    <div style={styles.hero}>
      <h1 style={styles.title}>{props.title}</h1>
      <p style={styles.subtitle}>{props.subtitle}</p>
      <button onClick={props.onCtaClick} style={styles.button}>
        {props.cta}
      </button>
    </div>
  );
}
```

Then, export it from `index.ts`.

```ts {% fileName="packages/ui/src/index.ts" %}
export * from './lib/hero';
export * from './lib/ui';
```

We're ready to import it into our main application now.

```tsx {% fileName="apps/demo/src/app/app.tsx" %}
import { Route, Routes } from 'react-router-dom';
// importing the component from the library
import { Hero } from '@acme/ui';

export function App() {
  return (
    <>
      <h1>Home</h1>
      <Hero
        title="Welcome to our Demo"
        subtitle="Build something amazing today"
        cta="Get Started"
      />
    </>
  );
}

export default App;
```

Serve your app again (`npx nx serve demo`) and you should see the new Hero component from the `ui` library rendered on the home page.

![](/shared/images/tutorials/react-demo-with-hero.png)

## Visualize your Project Structure

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `npx nx build`, enabling intelligent caching, and more. Interestingly you can also visualize it.

Just run:

```shell
npx nx graph
```

You should be able to see something similar to the following in your browser.

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "@acme/demo",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "@acme/ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "@acme/demo": [
      { "source": "@acme/demo", "target": "@acme/ui", "type": "static" }
    ],
    "@acme/ui": []
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

Let's create a git branch with the new hero component so we can open a pull request later:

```shell
git checkout -b add-hero-component
git add .
git commit -m 'add hero component'
```

## Testing and Linting - Running Multiple Tasks

Our current setup doesn't just come with targets for serving and building the React application, but also has targets for testing and linting. We can use the same syntax as before to run these tasks:

```shell
npx nx test demo # runs the tests for demo
npx nx lint ui   # runs the linter on ui
```

More conveniently, we can also run tasks in parallel using the following syntax:

```shell
npx nx run-many -t test lint
```

This is exactly what is configured in `.github/workflows/ci.yml` for the CI pipeline. The `run-many` command allows you to run multiple tasks across multiple projects in parallel, which is particularly useful in a monorepo setup.

You may notice that the test failed for the `demo` app because we've updated the content. Don't worry about it for now, we'll fix it in a moment with the help of Nx Cloud's self-healing feature.

### Cache Tasks

One thing to highlight is that Nx is able to [cache the tasks you run](/features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, (as can be seen in the output example below) there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="npx nx run-many -t test lint" path="~/acme" %}
   ✔  nx run @acme/ui:lint
   ✔  nx run @acme/ui:test
   ✔  nx run @acme/demo:lint
   ✖  nx run @acme/demo:test

—————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Ran targets test, lint for 2 projects (1s)

   ✔  3/4 succeeded [3 read from cache]

   ✖  1/4 targets failed, including the following:

      - nx run @acme/demo:test
```

Again, the `@acme/demo:test` task failed, but notice that the remaining three tasks were read from cache.

Not all tasks might be cacheable though. You can configure the `cache` settings in the `targetDefaults` property of the `nx.json` file. You can also [learn more about how caching works](/features/cache-task-results).

## Self-Healing CI with Nx Cloud

In this section, we'll explore how Nx Cloud can help your pull request get to green faster with self-healing CI. Recall that our demo app has a test failure, so let's see how this can be automatically resolved.

Before we continue, make sure you have `npx nx-cloud fix-ci` in your GitHub Actions workflow. This command is responsible for enabling self-healing CI.

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=[31,32] %}
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          filter: tree:0
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci --legacy-peer-deps
      - uses: nrwl/nx-set-shas@v4

      - run: npx nx affected -t lint test build

      - run: npx nx-cloud fix-ci
        if: always()
```

You will also need to install the [Nx Console](/getting-started/editor-setup) editor extension for VS Code, Cursor, or IntelliJ. For the complete AI setup guide, see our [AI integration documentation](/getting-started/ai-integration).

Now, let's push the `add-hero-component` branch to GitHub and open a new pull request.

```shell
git push origin add-hero-component
```

// TODO(jack): Show a screenshot of the PR on GitHub with the failed CI check.

As expected, the CI check fails because of the test failure in the `demo` app. Nx Console notifies you whenever a CI run completes, whether successfully or not. This means that you don't have waste time **babysitting your PRs**.

![Nx Console with failure notification](/shared/images/tutorials/react-ci-failure-console.png)

### Fix CI from Your Editor

From the Nx Console notification, you can click `Help me fix this error` button. Review the suggested unit test fix, and approve it. That's it!

// TODO(jack): The screenshot below should match the actual error and suggestion (I just pulled this from blog post since I woudln't get it to work)

![Suggested fix to update the test to match new text](/shared/images/tutorials/react-ci-fix-suggestion.avif)

Now, your pull request should be green, and you didn't have to leave your editor or do any manual work to fix it. This is the power of self-healing CI with Nx Cloud.

The remainder of this tutorial will focus on how to scale your monorepo to work with larger teams and large codebases. If this is not applicable to you now, feel free to skip ahead to [the end of the tutorial](#next-steps).

## Scaling Your Monorepo

// TODO(jack): We should put affected and distribution in this section, or create a separate guide and link to it.

## Next Steps

Here's some things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn how to [migrate your React app to Nx](/recipes/adopting-nx/adding-to-existing-project)
- Learn about [enforcing boundaries between projects](/features/enforce-module-boundaries)
- [Learn how to setup Tailwind](/technologies/react/recipes/using-tailwind-css-in-react)
- [Setup Storybook for our shared UI library](/technologies/test-tools/storybook/recipes/overview-react)

Also, make sure you

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
