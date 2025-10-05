---
title: Overview of the Nx Playwright Plugin
description: The Nx Plugin for Playwright contains executors and generators that support e2e testing with Playwright. This page also explains how to configure Playwright on your Nx workspace.
---

# @nx/playwright

Playwright is a modern web test runner. With included features such as:

- Cross browser support, including mobile browsers
- Multi tab, origin, and user support
- Automatic waiting
- Test generation
- Screenshots and videos

## Setting Up @nx/playwright

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/playwright` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/playwright` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/playwright
```

This will install the correct version of `@nx/playwright`.

### How @nx/playwright Infers Tasks

The `@nx/playwright` plugin will create a task for any project that has a Playwright configuration file present. Any of the following files will be recognized as a Playwright configuration file:

- `playwright.config.js`
- `playwright.config.ts`
- `playwright.config.mjs`
- `playwright.config.mts`
- `playwright.config.cjs`
- `playwright.config.cts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/playwright Configuration

The `@nx/playwright/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/playwright/plugin",
      "options": {
        "ciTargetName": "e2e-ci",
        "targetName": "e2e"
      }
    }
  ]
}
```

The `targetName` and `ciTargetName` options control the name of the inferred Playwright tasks. The default names are `e2e` and `e2e-ci`.

### Splitting E2E Tests

`@nx/playwright/plugin` leverages Nx Atomizer to split your e2e tests into smaller tasks in a fully automated way. This allows for a much more efficient distribution of tasks in CI. You can read more about the Atomizer feature [here](/ci/features/split-e2e-tasks).

If you would like to disable Atomizer for Playwright tasks, set `ciTargetName` to `false`.

## E2E Testing

By default, when creating a new frontend application, Nx will prompt for which e2e test runner to use. Select `playwright` or pass in the arg `--e2eTestRunner=playwright`

```shell
nx g @nx/web:app apps/frontend --e2eTestRunner=playwright
```

### Add Playwright e2e to an existing project

To generate an E2E project for an existing project, run the following generator

```shell
nx g @nx/playwright:configuration --project=your-app-name
```

Optionally, you can use the `--webServerCommand` and `--webServerAddress` option, to auto setup the [web server option](https://playwright.dev/docs/test-webserver) in the playwright config

```shell
nx g @nx/playwright:configuration --project=your-app-name --webServerCommand="npx serve your-project-name" --webServerAddress="http://localhost:4200"
```

### Testing Applications

Run `nx e2e <your-app-name>` to execute e2e tests with Playwright

{% callout type="note" title="Selecting Specific Specs" %}

You can use the `--grep/-g` flag to filter tests using regular expressions.
You can use the `--grepInvert/-gv` flag to filter out tests that match the regular expression.

```bash
# run tests that match the regular expression
nx e2e frontend-e2e --grep="feat-a"

# run tests that don't match the regular expression
nx e2e frontend-e2e --grepInvert="feat-a"
```

{% /callout %}

By default, Playwright will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Test output such as reports, screenshots and videos, will be accessible in `dist/.playwright/apps/<your-app-name>/`. This can be configured with the `outputDir` configuration options.

{% callout type="note" title="Output Caching" %}
If changing the output directory or report output, make sure to update the [target outputs](/concepts/how-caching-works#what-is-cached) so the artifacts are correctly cached
{% /callout %}

### Watching for Changes

With, `nx e2e frontend-e2e --ui` Playwright will start in headed mode where you can see your application being tested.

From, there you can toggle on the watch icon which will rerun the tests when the spec file updates.

```shell
nx e2e <your-app-name> --ui
```

You can also use `--headed` flag to run Playwright where the browser can be seen without using the [Playwright UI](https://playwright.dev/docs/test-ui-mode)

### Specifying a Project/Target Browser

The default generated Playwright configuration will contain a `projects` property that contains a list of browsers to run the tests against.

It should look similar to this:

```ts
export default defineConfig({
  ...,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    }
  ]
});
```

By default, Playwright will run tests against all browsers in the `projects` list.

You can specify a specific browser to run the tests against by passing the `--project` flag to the `nx e2e` command.

```shell
nx e2e frontend-e2e -- --project=firefox
```

{% callout type="note" title="Argument Forwarding" %}
As Nx also has a `--project` argument, you need to use `--` to forward the argument to the Playwright configuration.
{% /callout %}

### Specifying a Base Url

The `baseURL` property within the Playwright configuration can control where the tests visit by default.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Rest of your config...

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npx serve <your-app-name>',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4200', // url playwright visits with `await page.goto('/')`;
  },
});
```

In order to set different `baseURL` values for different environments you can pass them via the [environment variables and nx configurations](/recipes/tips-n-tricks/define-environment-variables) or optionally via setting them per the environment they are needed in such as `CI`

```ts
import { defineConfig } from '@playwright/test';

const baseUrl =
  process.env.BASE_URL ?? process.env.CI
    ? 'https://some-staging-url.example.com'
    : 'http://localhost:4200';

export default defineConfig({
  // Rest of your config...

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npx serve <your-app-name>',
    url: baseUrl,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: baseUrl, // url playwright visits with `await page.goto('/')`;
  },
});
```

By default Nx, provides a `nxE2EPreset` with predefined configuration for Playwright.

```ts
import { defineConfig } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './e2e' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npx nx serve <your-app-name>',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
});
```

This preset sets up the `outputDir` and [HTML reporter](https://playwright.dev/docs/test-reporters#html-reporter) to output in `dist/.playwright/<path-to-project-root>` and sets up chromium, firefox, webkit browsers to be used a browser targets. If you want to use mobile and/or branded browsers you can pass those options into the preset function

```ts
export default defineConfig({
  ...nxE2EPreset(__filename, {
    testDir: './e2e',
    includeMobileBrowsers: true, // includes mobile Chrome and Safari
    includeBrandedBrowsers: true, // includes Google Chrome and Microsoft Edge
  }),
  // other settings
});
```

If you want to override any settings within the `nxE2EPreset`, You can define them after the preset like so

```ts
const config = nxE2EPreset(__filename, {
  testDir: './e2e',
  includeMobileBrowsers: true, // includes mobile Chrome and Safari
  includeBrandedBrowsers: true, // includes Google Chrome and Microsoft Edge
});
export default defineConfig({
  ...config
  retries: 3,
  reporters: [...config.reporters, /* other reporter settings */],
});
```

See the [Playwright configuration docs](https://playwright.dev/docs/test-configuration) for more options for Playwright.
