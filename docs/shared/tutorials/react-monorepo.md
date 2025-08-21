---
title: 'React Monorepo Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building and Testing React Apps in Nx

This tutorial walks you through creating a React monorepo with Nx. You'll build a small example application to understand the core concepts and workflows.

What you'll learn:

- How to structure multiple React apps and libraries in a single repository
- How Nx's caching speeds up your local development and CI pipelines
- How to run builds, tests, and serve commands efficiently across multiple projects
- How to share React components and hooks between applications
- How to fix CI failures directly from your editor with Nx Cloud

## Prerequisite: Tutorial Setup

{% callout type="note" title="Prerequisites" %}
This tutorial requires a [GitHub account](https://github.com) to demonstrate the full value of **Nx** - including task running, caching, and CI integration.
{% /callout %}

### Step 1: Creating a new Nx React workspace

Let's create your workspace. The setup process takes about 2 minutes and will configure React, testing, and CI/CD automatically.

{% call-to-action variant="inverted" title="Start Building React Apps 10x Faster →" url="https://cloud.nx.app/create-nx-workspace/react/github" description="Zero-config setup with caching, testing, and CI ready out of the box" /%}

### Step 2: Verify Your Setup

Please verify closely that you have the following setup:

1. A new Nx workspace on your local machine
2. A corresponding GitHub repository for the workspace with a `.github/workflows/ci.yml` pipeline preconfigured
3. You completed the full Nx Cloud onboarding and you now have a Nx Cloud dashboard that is connected to your example repository on GitHub.

You should see your workspace in your [Nx Cloud organization](https://cloud.nx.app/orgs).

![](/shared/images/tutorials/connected-workspace.avif)

If you do not see your workspace in Nx Cloud then please follow the steps outlined in the [Nx Cloud setup](https://cloud.nx.app/create-nx-workspace/react/github).

This is important for using remote caching and self-healing in CI later in the tutorial.

## Explore the Nx Workspace Setup

Let's take a look at the structure of our new Nx workspace:

```plaintext
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

Here are some files that might jump to your eyes:

- The `.nx` folder is where Nx stores local metadata about your workspaces using the [Nx Daemon](/concepts/nx-daemon).
- The [`nx.json` file](/reference/nx-json) contains configuration settings for Nx itself and global default settings that individual projects inherit.
- The `.github/workflows/ci.yml` file preconfigures your CI in GitHub Actions to run build and test through Nx.

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

By default Nx simply runs your `package.json` scripts. However, you can also adopt [Nx technology plugins](/technologies) that help abstract away some of the lower-level config and have Nx manage that. One such thing is to automatically identify tasks that can be run for your project from [tooling configuration files](/concepts/inferred-tasks) such as `package.json` scripts and `vite.config.ts`.

In `nx.json` there's already the `@nx/vite` plugin registered which automatically identifies `build`, `test`, `serve`, and other Vite-related targets.

```json {% fileName="nx.json" %}
{
  ...
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "devTargetName": "dev",
        "previewTargetName": "preview",
        "serveStaticTargetName": "serve-static",
        "typecheckTargetName": "typecheck",
        "buildDepsTargetName": "build-deps",
        "watchDepsTargetName": "watch-deps"
      }
    }
  ]
}
```

To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

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
export function Hero(props: {
  title: string;
  subtitle: string;
  cta: string;
  onCtaClick?: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: '#1a1a2e',
        color: 'white',
        padding: '100px 20px',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '48px',
          marginBottom: '16px',
        }}
      >
        {props.title}
      </h1>
      <p
        style={{
          fontSize: '20px',
          marginBottom: '32px',
        }}
      >
        {props.subtitle}
      </p>
      <button
        onClick={props.onCtaClick}
        style={{
          backgroundColor: '#0066ff',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          fontSize: '18px',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
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
        title="Welcmoe to our Demo"
        subtitle="Build something amazing today"
        cta="Get Started"
      />
    </>
  );
}

export default App;
```

Serve your app again (`npx nx serve demo`) and you should see the new Hero component from the `ui` library rendered on the home page.

![](/shared/images/tutorials/react-demo-with-hero.avif)

If you have keen eyes, you may have noticed that there is a typo in the `App` component. This mistake is intentional, and we'll see later how Nx can fix this issue automatically in CI.

## Visualize your Project Structure

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `npx nx build`, enabling intelligent caching, and more. Interestingly, you can also visualize it.

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

There is a test failure for the `demo` app due to the updated content. Don't worry about it for now, we'll fix it in a moment with the help of Nx Cloud's self-healing feature.

### Local Task Cache

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

The `npx nx-cloud fix-ci` command that is already included in your GitHub Actions workflow (`github/workflows/ci.yml`) is responsible for enabling self-healing CI and will automatically suggest fixes to your failing tasks.

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

      - run: npx nx run-many -t lint test build

      - run: npx nx-cloud fix-ci
        if: always()
```

You will also need to install the [Nx Console](/getting-started/editor-setup) editor extension for VS Code, Cursor, or IntelliJ. For the complete AI setup guide, see our [AI integration documentation](/getting-started/ai-integration).

{% install-nx-console /%}

Now, let's push the `add-hero-component` branch to GitHub and open a new pull request.

```shell
git push origin add-hero-component
# Don't forget to open a pull request on GitHub
```

As expected, the CI check fails because of the test failure in the `demo` app. But rather than looking at the pull request, Nx Console notifies you that the run has completed, and that it has a suggested fix for the failing test. This means that you don't have to waste time **babysitting your PRs**, and the fix can be applied directly from your editor.

![Nx Console with failure notification](/shared/images/tutorials/react-ci-notification.avif)

### Fix CI from Your Editor

From the Nx Console notification, you can click `Show Suggested Fix` button. Review the suggested fix, which in this case is to change the typo `Welcmoe`to the correct `Welcome` spelling. Approve this fix by clicking `ApplyFix` and that's it!

![Suggestion to fix the typo in the editor](/shared/images/tutorials/react-ci-suggestion.avif)

You didn't have to leave your editor or do any manual work to fix it. This is the power of self-healing CI with Nx Cloud.

### Remote Cache for Faster Time To Green

After the fix has been applied and committed, CI will re-run automatically, and you will be notified of the results in your editor.

![Tasks with remote cache hit](/shared/images/tutorials/react-remote-cache-notification.avif)

When you click `View Results` to show the run in Nx Cloud, you'll notice something interesting. The lint and test tasks for the `ui` library were read from remote cache and did not have to run again, thus each taking less than a second to complete.

![Nx Cloud run showing remote cache hits](/shared/images/tutorials/react-remote-cache-cloud.avif)

This happens because Nx Cloud caches the results of tasks and reuses them across different CI runs. As long as the inputs for each task have not changed (e.g. source code), then their results can be replayed from Nx Cloud's [Remote Cache](/ci/features/remote-cache). In this case, since the last fix was applied only to the `demo` app's source code, none of the tasks for `ui` library had to be run again.

This significantly speeds up the time to green for your pull requests, because subsequent changes to them have a good chance to replay tasks from cache.

{% callout type="note" title="Remote Cache Outputs" %}
Outputs from cached tasks, such as the `dist` folder for builds or `coverage` folder for tests, are also read from cache. Even though a task was not run again, its outputs are available. The [Cache Task Results](/features/cache-task-results) page provides more details on caching.
{% /callout %}

This pull request is now ready to be merged with the help of Nx Cloud's self-healing CI and remote caching.

![Pull request is green](/shared/images/tutorials/react-ci-green.avif)

## Next Steps

Here are some things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn how to [migrate your existing project to Nx](/recipes/adopting-nx/adding-to-existing-project)
- [Setup Storybook for our shared UI library](/technologies/test-tools/storybook/recipes/overview-react)
- [Learn how to setup Tailwind](/technologies/react/recipes/using-tailwind-css-in-react)
- Learn about [enforcing boundaries between projects](/features/enforce-module-boundaries)

Also, make sure you

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
