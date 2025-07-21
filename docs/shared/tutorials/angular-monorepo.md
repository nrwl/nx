---
title: 'Angular Monorepo Tutorial'
description: In this tutorial you'll create a frontend-focused workspace with Nx.
---

# Building and Testing Angular Apps in Nx

In this tutorial, you'll learn how to create a new Angular monorepo using the Nx platform.

What will you learn?

- how to create a new Angular workspace with [GitHub Actions](https://github.com/features/actions) preconfigured
- how to run a single task (i.e. serve your app) or run multiple tasks in parallel
- how to modularize your codebase with local libraries for better code organization
- how to benefit from caching that works both locally and in CI
- how to set up self-healing CI to apply fixes directly from your local editor

## Prerequisite: Tutorial Setup

{% callout type="note" title="Prerequisites" %}
This tutorial requires a [GitHub account](https://github.com) to demonstrate the full value of **Nx** - including task running, caching, and CI integration.
{% /callout %}

### Step 1: Creating a new Nx Angular workspace

Let's start by creating a new Angular monorepo with Nx Cloud and GitHub Actions preconfigured. You'll be guided through an interactive setup process to create your workspace. After completing the setup, return here to continue with this tutorial.

{% call-to-action title="Create a new Angular monorepo" url="https://cloud.nx.app/create-nx-workspace?preset=angular" description="With Nx and GitHub Actions fully set up" /%}

### Step 2: Verify Your Setup

Please verify closely that you have the following setup:

1. A new Nx workspace on your local machine
2. A corresponding GitHub repository for the workspace with a `.github/workflows/ci.yml` pipeline preconfigured
3. You completed the full Nx Cloud onboarding and you now have a Nx Cloud dashboard that is connected to your example repository on GitHub.

You should see your workspace in your [Nx Cloud organization](https://cloud.nx.app/orgs).

![](/shared/images/tutorials/connected-workspace.avif)

If you do not see your workspace in Nx Cloud then please follow the steps outlined in the [Nx Cloud setup](https://cloud.nx.app/create-nx-workspace?preset=angular).

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
└── vitest.workspace.ts
```

Here are some files that might jump to your eyes:

- The `.nx` folder is where Nx stores local metadata about your workspaces using the [Nx Daemon](/concepts/nx-daemon).
- The [`nx.json` file](/reference/nx-json) contains configuration settings for Nx itself and global default settings that individual projects inherit.
- The `.github/workflows/ci.yml` file preconfigures your CI in GitHub Actions to run build and test through Nx.

Now, let's build some features and see how Nx helps get us to production faster.

## Serving the App

To serve your new Angular app, run:

```shell
npx nx serve demo
```

The app is served at [http://localhost:4200](http://localhost:4200).

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Project Configuration

The project tasks are defined in the `project.json` file.

```json {% fileName="apps/demo/project.json" %}
{
  "name": "demo",
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

```json {% fileName="project.json" %}
{
  "name": "angular-store",
  ...
  "targets": {
    "serve": {
      "executor": "@angular/build:dev-server",
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

To view all tasks for a project, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

```shell
npx nx show project demo
```

{% project-details title="Project Details View (Simplified)" %}

```json
{
  "project": {
    "name": "demo",
    "type": "app",
    "data": {
      "root": "apps/demo",
      "targets": {
        "build": {
          "executor": "@angular/build:application",
          "outputs": ["{options.outputPath}"],
          "options": {
            "outputPath": "dist/apps/demo",
            "browser": "apps/demo/src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "apps/demo/tsconfig.app.json",
            "assets": [
              {
                "glob": "**/*",
                "input": "apps/demo/public"
              }
            ],
            "styles": ["apps/demo/src/styles.css"]
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kb",
                  "maximumError": "1mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "4kb",
                  "maximumError": "8kb"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "production",
          "parallelism": true,
          "cache": true,
          "dependsOn": ["^build"],
          "inputs": ["production", "^production"]
        }
      }
    }
  },
  "sourceMap": {
    "root": ["apps/demo/project.json", "nx/core/project-json"],
    "targets": ["apps/demo/project.json", "nx/core/project-json"],
    "targets.build": ["apps/demo/project.json", "nx/core/project-json"],
    "name": ["apps/demo/project.json", "nx/core/project-json"],
    "$schema": ["apps/demo/project.json", "nx/core/project-json"],
    "sourceRoot": ["apps/demo/project.json", "nx/core/project-json"],
    "projectType": ["apps/demo/project.json", "nx/core/project-json"],
    "tags": ["apps/demo/project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

## Modularization with Local Libraries

When you develop your Angular application, usually all your logic sits in the app's `src` folder. Ideally separated by various folder names which represent your domains or features. As your app grows, however, the app becomes more and more monolithic, which makes building and testing it harder and slower.

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
npx nx g @nx/angular:library packages/ui --unitTestRunner=vitest
```

Note how we type out the full path in the command to place the library into a subfolder. You can choose whatever folder structure you like to organize your projects.

Running the above command should lead to the following directory structure:

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

All libraries that we generate are automatically included in the TypeScript path mappings configured in the root-level `tsconfig.base.json`.

```json {% fileName="tsconfig.base.json" %}
{
  "compilerOptions": {
    ...
    "paths": {
      "@acme/ui": ["packages/ui/src/index.ts"]
    },
    ...
  },
}
```

Hence, we can easily import them into other libraries and our Angular application.

You can see that the `Ui` component is exported via the `index.ts` file of our `ui` library so that other projects in the repository can use it. This is our public API with the rest of the workspace and is enforced by the library's build configuration. Only export what's necessary to be usable outside the library itself.

```ts {% fileName="packages/ui/src/index.ts" %}
export * from './lib/ui/ui';
```

Let's add a simple `Hero` component that we can use in our demo app.

```ts {% fileName="packages/ui/src/lib/hero/hero.ts" %}
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div [ngStyle]="containerStyle">
      <h1 [ngStyle]="titleStyle">{{ title }}</h1>
      <p [ngStyle]="subtitleStyle">{{ subtitle }}</p>
      <button (click)="handleCtaClick()" [ngStyle]="buttonStyle">
        {{ cta }}
      </button>
    </div>
  `,
})
export class Hero {
  @Input() title!: string;
  @Input() subtitle!: string;
  @Input() cta!: string;
  @Output() ctaClick = new EventEmitter<void>();

  containerStyle = {
    backgroundColor: '#1a1a2e',
    color: 'white',
    padding: '100px 20px',
    textAlign: 'center',
  };

  titleStyle = {
    fontSize: '48px',
    marginBottom: '16px',
  };

  subtitleStyle = {
    fontSize: '20px',
    marginBottom: '32px',
  };

  buttonStyle = {
    backgroundColor: '#0066ff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    fontSize: '18px',
    borderRadius: '4px',
    cursor: 'pointer',
  };

  handleCtaClick() {
    this.ctaClick.emit();
  }
}
```

Then, export it from `index.ts`.

```ts {% fileName="packages/ui/src/index.ts" %}
export * from './lib/hero/hero';
export * from './lib/ui/ui';
```

We're ready to import it into our main application now.

```ts {% fileName="apps/demo/src/app/app.ts" %}
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// importing the component from the library
import { Hero } from '@acme/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Hero],
  template: `
    <lib-hero
      title="Welcmoe demo"
      subtitle="Build something amazing today"
      cta="Get Started"
    ></lib-hero>
  `,
})
export class App {}
```

Serve your app again (`npx nx serve demo`) and you should see the new Hero component from the `ui` library rendered on the home page.

![](/shared/images/tutorials/angular-demo-with-hero.avif)

If you have keen eyes, you may have noticed that there is a typo in the `App` component. This mistake is intentional, and we'll see later how Nx can fix this issue automatically in CI.

## Visualize your Project Structure

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `npx nx build`, identifying [affected projects](/features/run-tasks#run-tasks-on-projects-affected-by-a-pr) and more. Interestingly, you can also visualize it.

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
      "name": "demo",
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
    }
  ],
  "dependencies": {
    "demo": [{ "source": "demo", "target": "ui", "type": "static" }],
    "ui": []
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

Our current setup not only has targets for serving and building the Angular application, but also has targets for unit testing, e2e testing and linting. The `test` and `lint` targets are defined in the application `project.json` file. We can use the same syntax as before to run these tasks:

```bash
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
   ✔  nx run ui:lint
   ✔  nx run ui:test
   ✔  nx run demo:lint
   ✖  nx run demo:test

—————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Ran targets test, lint for 2 projects (1s)

   ✔  3/4 succeeded [3 read from cache]

   ✖  1/4 targets failed, including the following:

      - nx run demo:test
```

Again, the `demo:test` task failed, but notice that the remaining three tasks were read from cache.

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

![Nx Console with failure notification](/shared/images/tutorials/angular-ci-notification.avif)

### Fix CI from Your Editor

From the Nx Console notification, you can click `Show Suggested Fix` button. Review the suggested fix, which in this case is to change the typo `Welcmoe `to the correct `Welcome` spelling. Approve this fix by clicking `ApplyFix` and that's it!

![Suggestion to fix the typo in the editor](/shared/images/tutorials/angular-ci-suggestion.avif)

You didn't have to leave your editor or do any manual work to fix it. This is the power of self-healing CI with Nx Cloud.

### Remote Cache for Faster Time To Green

After the fix has been applied and committed, CI will re-run automatically, and you will be notified of the results in your editor.

![Tasks with remote cache hit](/shared/images/tutorials/angular-remote-cache-notification.avif)

When you click `View Results` to show the run in Nx Cloud, you'll notice something interesting. The lint and test tasks for the `ui` library were read from remote cache and did not have to run again, thus each taking less than a second to complete.

![Nx Cloud run showing remote cache hits](/shared/images/tutorials/angular-remote-cache-cloud.avif)

This happens because Nx Cloud caches the results of tasks and reuses them across different CI runs. As long as the inputs for each task have not changed (e.g. source code), then their results can be replayed from Nx Cloud's [Remote Cache](/ci/features/remote-cache). In this case, since the last fix was applied only to the `demo` app's source code, none of the tasks for `ui` library had to be run again.

This significantly speeds up the time to green for your pull requests, because subsequent changes to them have a good chance to replay tasks from cache.

{% callout type="note" title="Remote Cache Outputs" %}
Outputs from cached tasks, such as the `dist` folder for builds or `coverage` folder for tests, are also read from cache. Even though a task was not run again, its outputs are available. The [Cache Task Results](/features/cache-task-results) page provides more details on caching.
{% /callout %}

This pull request is now ready to be merged with the help of Nx Cloud's self-healing CI and remote caching.

![Pull request is green](/shared/images/tutorials/angular-ci-green.avif)

## Next Steps

Here are some things you can dive into next:

- Read more about [how Nx compares to the Angular CLI](/technologies/angular/recipes/nx-and-angular)
- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn about popular generators such as [how to setup Tailwind](/technologies/angular/recipes/using-tailwind-css-with-angular-projects)
- Learn how to [migrate your existing Angular CLI repo to Nx](/technologies/angular/migration/angular)
- Learn about [enforcing boundaries between projects](/features/enforce-module-boundaries)
- [Setup Storybook for our shared UI library](/technologies/test-tools/storybook/recipes/overview-angular)

Also, make sure you

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights
