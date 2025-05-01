---
title: 'Modern Angular Testing with Nx'
slug: modern-angular-testing-with-nx
authors: ['Jack Hsu']
tags: ['angular', 'nx']
cover_image: /blog/images/2025-03-17/modern-angular-testing.avif
description: 'Learn how Nx enhances Angular testing by integrating modern tools like Playwright and Vitest, improving test speed, reliability, and CI scalability.'
---

{% callout type="deepdive" title="Angular Week Series" expanded=true %}

This article is part of the Angular Week series:

- **Modern Angular Testing with Nx**
- [Angular Architecture Guide To Building Maintainable Applications at Scale](/blog/architecting-angular-applications)
- [Using Rspack with Angular](/blog/using-rspack-with-angular)
- [Enterprise Patterns](/blog/enterprise-angular-book)

{% /callout %}

Testing is a crucial part of any application to ensure correctness and guard against regression, and Angular is no exception. Here at Nx, we're big fans of Angular, and we think that we can drastically improve the unit testing and end-to-end (E2E) experience for Angular developers.

Modern tools have evolved to make testing faster, more reliable, and developer-friendly. The Angular team has recognized this shift in the testing landscape. They've officially announced that [Protractor is in maintenance mode](https://blog.angular.dev/the-state-of-end-to-end-testing-with-angular-d175f751cb9c) and recommend using modern alternatives like Playwright or Cypress. Similarly, while Karma is still supported, the team [acknowledges the benefits of modern test runners](https://blog.angular.dev/moving-angular-cli-to-jest-and-web-test-runner-ef85ef69ceca) like Jest and Vitest, especially in terms of performance and developer experience.

In this post, we'll explore how the Nx unlocks modern testing tools for Angular developers, and how Nx can help your CI scale as your team and codebase grow.

## **Effortless E2E Testing at Scale**

New Nx Angular workspaces come with Playwright as the E2E testing framework by default.

```shell
npx create-nx-workspace@latest --preset=angular-monorepo --appName=my-app
```

You can use Cypress by passing the `--e2eTestRunner=cypress` option. We will use Playwright for this example, but the benefits that Nx brings apply to both frameworks.

Once you have the workspace created, you can see the E2E tests in action by running the following:

```shell
npx nx e2e my-app-e2e
```

This command runs `playwright test` underneath the hood. This is just standard tooling, and there is nothing Nx-specific about the tests. Nx comes into play with the `@nx/playwright` plugin, as you see inside your `nx.json` file. The `@nx/playwright` plugin does a few things.

First, it makes the `e2e` command cacheable, so running it again without changes source files nor test files will replay the command from cache.

```shell
npx nx e2e my-app-e2e
```

You should see a message as follows the second time:

```{% command="npx nx e2e my-app-e2e" %}
NX  Successfully ran target e2e for project my-app-e2e (154ms)

Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

This is a powerful feature, especially when used in conjunction with [Remote Caching](/ci/features/remote-cache) (i.e. Nx Replay).

How does Nx understand when a task can be read from cache? Well, the `@nx/playwright` also autoconfigures task inputs for you. So, unless a relevant file is changed, the task can be read from cache. That means updates to `README.md` will replay E2E tests from cache rather than running the expensive task.

Another thing that Nx handles automatically for you is restoring outputs from cache. You'll notice that an HTML report is generated in the `dist/.playwright` folder.

```
dist/.playwright/apps/my-app-e2e
├── playwright-report
│  └── index.html
└── test-output
```

You can remove this folder, and when Nx replays the task from cache, the test artifacts will be restored.

```
rm -rf dist
npx nx e2e my-app-e2e
tree dist/.playwright/apps/my-app-e2e
```

You should see the exact same output in `dist` even though the Playwright tests didn't actually run.

To see how Nx configures your project, you can use `nx show project`.

```shell
npx nx show project my-app-e2e
npx nx show project my-app
```

![Nx Cloud Result](/blog/images/2025-03-17/Screenshot_2025-03-05_at_10.44.52_AM.png)

We also recommend that you install the Nx Console extension for VSCode, Cursor, and IntelliJ. It seamlessly integrates the [Project Details View](/recipes/nx-console/console-project-details) with your editor. To install it visit the Marketplace pages:

- [VSCode extension](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console)
- [IntelliJ plugin](https://plugins.jetbrains.com/plugin/21060-nx-console)

Okay, the caching is already great on its own, but Nx has another very powerful feature to help you scale your CI.

### **Automatic E2E Test Distribution**

As workspaces grow, they often run into CI scaling issues that are hard to solve. E2E tests are often the main culprit of CI slowness, as a test suite can take several hours to run in large workspaces. This is just the reality for many teams, where you need the large test suites to ensure quality, but it's impossible to iterate quickly when each CI run takes hours.

Fortunately, Nx has a solution that does not require complicated pipeline files or a whole team of infrastructure engineers to keep CI running smoothly. That solution is [Automatic Test Splitting](/ci/features/split-e2e-tasks) (or Nx Atomizer).

If you view the `my-app-e2e` project (`npx nx show project my-app-e2e`), you will notice that there is an `e2e-ci` target, with additional targets created for each test file. This is the task splitting feature that `@nx/playwright` enables. Whereas the `e2e` target runs the full Playwright suite, the `e2e-ci` task runs additional tasks created from test files.

When run on a single machine, `e2e-ci` will be slower because it starts multiple Playwright processes, which is why we only allow it to run through distribution. To [enable distribution](/ci/features/split-e2e-tasks#enable-automated-e2e-task-splitting), you must connect your workspace to [Nx Cloud](/nx-cloud). This is easily done with the `connect` command.

```shell
npx nx connect
```

Follow the onboarding steps and you should be connected within five minutes. For more information, check out our [GitHub Actions Tutorial](/ci/intro/tutorials/github-actions) or our [guides](/ci/recipes/set-up) for all supported CI providers (GitHub, GitLab, Azure, etc.).

Now, let's take a look at a concrete example to get an idea of how much time-saving you can unlock with Nx Atomizer. I created [this repo](https://github.com/jaysoo/angular-testing-demo) that contains a simple Angular application and a UI package. It also has 40 Playwright test files.

```
apps/demo-e2e/src
├── example-1.spec.ts
├── example-2.spec.ts
├── example-3.spec.ts
├── ...
└── example-40.spec.ts
```

Where each file uses `page.waitForTimeout` to artificially simulate run-running tests.

```ts
import { test, expect } from '@playwright/test';

test('example 1 - test 1', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  expect(page.url()).toBe(page.url());
});

test('example 1 - test 2', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  expect(page.url()).toBe(page.url());
});

// ...

test('example 1 - test 10', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  expect(page.url()).toBe(page.url());
});
```

Using this [workflow file](https://github.com/jaysoo/angular-testing-demo/blob/main/.github/workflows/ci.yml) for GitHub Actions, we see that running unit tests and E2E tests take roughly 23 minutes in total.

- CI without distribution: [https://github.com/jaysoo/angular-testing-demo/actions/runs/13677108651](https://github.com/jaysoo/angular-testing-demo/actions/runs/13677108651)

In the [`feat/nx-cloud/setup`](https://github.com/jaysoo/angular-testing-demo/tree/feat/nx-cloud/setup) branch and PR, you can see that the [workflow file](https://github.com/jaysoo/angular-testing-demo/blob/feat/nx-cloud/setup/.github/workflows/ci.yml) is updated to enable distribution via Nx Agents.

```yaml
name: CI
# ...
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      # ...
      - run: npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js" --stop-agents-after="e2e-ci"
      # ...
      - run: npx nx affected -t test e2e-ci
```

With distribution enabled, the total CI time went from 23 minutes to 6 minutes, which is over 70% reduction in total duration.

- CI with distribution: [https://github.com/jaysoo/angular-testing-demo/actions/runs/13677116398](https://github.com/jaysoo/angular-testing-demo/actions/runs/13677116398)

You can see that the CI pipeline distributes individual test files on multiple agents.

![Nx Cloud In Progress](/blog/images/2025-03-17/Screenshot_2025-03-05_at_8.32.11_AM.png)

That is significant time-saving! As your codebase grows, you have the option to increase distribution by changing the `--distribute-on` option to ensure that CI still runs fast.

```yaml
# Use 12 agents
npx nx-cloud start-ci-run --distribute-on="12 linux-medium-js" --stop-agents-after="e2e-ci"
```

### Dynamic Agent Allocation

You can even [dynamically allocate agents](/ci/features/dynamic-agents#dynamically-allocate-agents) depending on how big the changeset is. To do this, add an YAML file as follows:

```yaml
# .nx/workflows/distribution-config.yaml
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 8 linux-medium-js
  large-changeset: 12 linux-medium-js
```

Then, use that file in the `--distribute-on` option.

```yaml
npx nx-cloud start-ci-run --distribute-on=".nx/workflows/distribution-config.yaml" --stop-agents-after="e2e-ci"
```

### Flakiness Detection and Automatic Re-runs

One last thing I want to mention, is that Nx can also help with flaky tests. Nx Cloud can reliably detect flaky tests and automatically re-run them. See the documentation on the [Re-run Flaky Tests](/ci/features/flaky-tasks) for more detail.

All of this power comes at very little complexity and maintenance burden. Nx allows you to declaratively describe what you want to run, and how you want to distribute tasks, and we do all the heavy lifting for you.

As we've seen, Nx is the easiest way for you to scale your E2E tests as your team and codebase grow, without dealing with complicated CI pipelines yourself. CI times can be drastically cut down by more than 70%, as seen in the example above. This enables teams to move faster and deliver value without being slowed down by CI.

Next, let's take a look at how Nx helps with modernizing unit tests.

## **Modern Unit Testing: Beyond Karma**

While Angular CLI traditionally uses [Karma for unit testing](https://angular.dev/guide/testing/test-environment), Nx enables you to leverage more modern testing frameworks like [Vitest](https://vitest.dev/) and [Jest](https://jestjs.io/). The Angular team has been [exploring modern alternatives to Karma](https://blog.angular.dev/moving-angular-cli-to-jest-and-web-test-runner-ef85ef69ceca), recognizing the benefits these tools bring. Let's explore why this matters by comparing Vitest with Karma. Many of these benefits also apply to Jest, which the Angular CLI team has plans to officially support. There are currently no plan for Angular CLI to support Vitest.

### **Why Choose Vitest over Karma?**

The benefits of modern test runners like Vitest are well-documented in the [official Vitest documentation](https://vitest.dev/guide/why.html) and the [Angular blog](https://blog.angular.dev/moving-angular-cli-to-jest-and-web-test-runner-ef85ef69ceca). Here's why they're a compelling choice:

### **Performance Features**

- **Native ESM Support**: Tests run directly without bundling, unlike Karma
- **Parallel Test Execution**: Tests run concurrently by default
- **Efficient Resource Usage**: Modern architecture reduces memory usage
- **Watch Mode with HMR**: Near-instant feedback during development

### **Developer Experience**

- **Better Debugging**: Improved error messages and stack traces
- **Rich Plugin Ecosystem**: Wide range of tools and extensions
- **Snapshot Testing**: Easily test UI components
- **Modern API**: Intuitive, promise-based test writing
- **Active Community**: Regular updates and improvements

While actual performance gains vary by project size, teams consistently report faster test execution and improved developer experience when switching from Karma to modern test runners. This improvement in speed is can be largely attributed to not relying on real browsers and running tests in a simulated environment using pure-JavaScript DOM implementations such as `jsdom`.

### **Setting Up Modern Unit Tests**

Setting up Vitest for your Angular project with Nx is straightforward:

```bash
# Add the Vite plugin
npx nx add @nx/vite

# Configure Vitest for a project
npx nx g @nx/vite:vitest
```

This should generate a Vitest configuration file like the following:

```tsx
// vite.config.mts
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';

export default defineConfig({
  plugins: [angular()],
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './coverage/my-app',
      provider: 'v8',
    },
  },
});
```

Now, you can run your unit tests through Vitest:

```shell
npx nx test my-app --watch
```

![Vitest Output](/blog/images/2025-03-17/Screenshot_2025-03-05_at_1.14.58_PM.png)

Note, that you may have a conflicting `test` target, which can be resolved by removing or renaming the old target in `project.json`:

```json
{
  "targets": {
    "karma:test": {
      "executor": "@angular-devkit/build-angular:karma",
      "options": {
        "polyfills": ["zone.js", "zone.js/testing"],
        "tsConfig": "tsconfig.spec.json",
        "assets": [
          {
            "glob": "**/*",
            "input": "public"
          }
        ],
        "styles": ["src/styles.css"],
        "scripts": []
      }
    }
  }
}
```

Big shout-out to Brandon Roberts and the Analog team for bringing [Angular-support to Vitest](https://analogjs.org/docs/features/testing/vitest).

Try it out yourself by cloning the example repo:

```shell
# Set up
git clone https://github.com/jaysoo/angular-testing-demo.git
cd angular-testing-demo
npm install

# Run test for each project
npx nx test demo
npx nx test ui

# Run in interactive mode (try updating files to see how fast HMR is)
npx nx test ui --watch

# Run all tests
npx nx run-many -t test
```

The improvements for local development is night and day. Receive instant feedback when you run in watch mode, leverage modern [debugging tools integration](https://vitest.dev/guide/debugging), better error messages and stack traces, and more. CI is also improved by reducing flakiness and inconsistencies across environments, by not relying on real browsers.

### Generate New Projects with Vitest

The application and library generators that come with `@nx/angular` both support using Vitest as the unit test runner.

```shell
npx nx g @nx/angular:app apps/demo --unitTestRunner=vitest
npx nx g @nx/angular:lib packages/ui --unitTestRunner=vitest
```

Note that Jest is also supported if that is preferred.

```shell
npx nx g @nx/angular:app apps/demo --unitTestRunner=jest
npx nx g @nx/angular:lib packages/ui --unitTestRunner=jest
```

This means you can easily create new projects and be productive immediately.

## Getting Started with Nx

Now that you’re convinced to give Nx a try, let's go over a few ways to install Nx to your workspace.

For a new workspaces, which is great to get started with Nx for the first time, use the `create-nx-workspace` command.

```shell
npx create-nx-workspace@latest --preset=angular-monorepo --appName=my-app
```

Follow, the prompts and you're good to go!

For existing Angular CLI projects, you can run `nx init` inside the workspace. This will keep the file structure as is and minimally add Nx to the workspace.

```shell
ng new my-app
cd my-app
npx nx@latest init
```

Alternatively, you can convert your project into a monorepo using the `--integrated` flag. A monorepo gives you the ability to integrate more projects to it, such as other webapps or backends.

```shell
ng new my-app
cd my-app
npx nx@latest init --integrated
```

Run a few Nx commands to try it out!

```shell
npx nx show project my-app
npx nx graph
npx nx serve my-app
npx nx test my-app
```

For more information, check out our [Getting Started](/getting-started/intro) docs.

## **Conclusion**

Modern testing tools have evolved significantly, offering better developer experience and faster execution times. By leveraging Nx's capabilities with Playwright for E2E testing and modern frameworks like Vitest for unit testing, you can create a more efficient and enjoyable testing workflow for your Angular teams.

CI reliability and duration are improved through:

- Automatic and effortless E2E test distribution
- Flaky task detection and automatic retries
- Faster and more consistent unit tests through modern tools like Vitest
