---
title: Overview of the Nx Cypress Plugin
description: The Nx Plugin for Cypress contains executors and generators that support e2e testing with Cypress. This page also explains how to configure Cypress on your Nx workspace.
---

Cypress is a test runner built for the modern web. It has a lot of great features:

- Time travel
- Real-time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

## Setting Up @nx/cypress

> Info about [Cypress Component Testing can be found here](/recipes/cypress/cypress-component-testing)
>
> Info about [using Cypress and Storybook can be found here](/recipes/storybook/overview-react#cypress-tests-for-storiesbook)

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/cypress` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/cypress` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/cypress
```

This will install the correct version of `@nx/cypress`.

### How @nx/cypress Infers Tasks

The `@nx/cypress` plugin will create a task for any project that has a Cypress configuration file present. Any of the following files will be recognized as a Cypress configuration file:

- `cypress.config.js`
- `cypress.config.ts`
- `cypress.config.mjs`
- `cypress.config.mts`
- `cypress.config.cjs`
- `cypress.config.cts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/cypress Configuration

The `@nx/cypress/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/cypress/plugin",
      "options": {
        "ciTargetName": "e2e-ci",
        "targetName": "e2e",
        "componentTestingTargetName": "component-test"
      }
    }
  ]
}
```

- The `targetName`, `ciTargetName` and `componentTestingTargetName` options control the namea of the inferred Cypress tasks. The default names are `e2e`, `e2e-ci` and `component-test`.

### Splitting E2E tasks by file

The `@nx/cypress/plugin` will automatically split your e2e tasks by file. You can read more about this feature [here](/ci/features/split-e2e-tasks).

To enable e2e task splitting, make sure there is a `ciWebServerCommand` property set in your `cypress.config.ts` file. It will look something like this:

```ts {% fileName="apps/my-project-e2e/cypress.config.ts" highlightLines=[13] %}
import { defineConfig } from 'cypress';
import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';

export default defineConfig({
  e2e: {
    ...nxE2EPreset(__filename, {
      cypressDir: 'src',
      bundler: 'vite',
      webServerCommands: {
        default: 'nx run my-project:serve',
        production: 'nx run my-project:preview',
      },
      ciWebServerCommand: 'nx run my-project:serve-static',
    }),
    baseUrl: 'http://localhost:4200',
  },
});
```

Note: The `nxE2EPreset` is a collection of default settings, but is not necessary for task splitting.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/cypress` package with your package manager.

```shell
npm add -D @nx/cypress
```

{% /tab %}
{% /tabs %}

## E2E Testing

By default, when creating a new frontend application, Nx will use Cypress to create the e2e tests project.

```shell
nx g @nx/web:app frontend
```

### Configure Cypress for an existing project

To configure Cypress for an existing project, run the following generator

```shell
nx g @nx/cypress:configuration --project=your-app-name
```

Optionally, you can use the `--baseUrl` option if you don't want the Cypress plugin to serve `your-app-name`.

```shell
nx g @nx/cypress:configuration --project=your-app-name --baseUrl=http://localhost:4200
```

Replace `your-app-name` with the app's name as defined in your `tsconfig.base.json` file or the `name` property of your `package.json`.

### Testing Applications

Run `nx e2e frontend-e2e` to execute e2e tests with Cypress.

You can run your e2e test against a production build by using the `production` [configuration](https://nx.dev/concepts/executors-and-configurations#use-task-configurations)

```shell
nx e2e frontend-e2e --configuration=production
```

{% callout type="note" title="Selecting Specific Specs" %}

You can use the `--spec` flag to glob for test files

```bash
# run the tests in the smoke/ directory
nx e2e frontend-e2e --spec=**smoke/**

# run the tests in smoke/ directory and with dashboard in the file name
nx e2e frontend-e2e --spec=**smoke/**,**dashboard.cy**
```

{% /callout %}

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/cypress/apps/frontend/screenshots` and `dist/cypress/apps/frontend/videos`.

### Watching for Changes (Headed Mode)

With, `nx e2e frontend-e2e --watch` Cypress will start in headed mode where you can see your application being tested.

Running Cypress with `--watch` is a great way to enhance dev workflow - you can build up test files with the application
running and Cypress will re-run those tests as you enhance and add to the suite.

```shell
nx e2e frontend-e2e --watch
```

### Specifying a Custom Url to Test

The `baseUrl` property provides you the ability to test an application hosted on a specific domain.

```shell
nx e2e frontend-e2e --baseUrl=https://frontend.com
```

> If no `baseUrl` and no `devServerTarget` are provided, Cypress will expect to have the `baseUrl` property in
> the cypress config file, or will error.

## Using cypress.config.ts

If you need to fine tune your Cypress setup, you can do so by modifying `cypress.config.ts` in the project root. For
instance,
you can easily add your `projectId` to save all the screenshots and videos into your Cypress dashboard. The complete
configuration is documented
on [the official website](https://docs.cypress.io/guides/references/configuration.html#Options).

For adding more dynamic configurations to your cypress configuration, you can look into using [setupNodeEvents](https://docs.cypress.io/api/plugins/browser-launch-api#Syntax) configuration option.

## Environment Variables

If you're needing to pass a variable to cypress that you wish to not commit to your repository, i.e. API keys, or dynamic values based on configurations, i.e. API Urls. This is where [Cypress environment variables](https://docs.cypress.io/guides/guides/environment-variables) can be used.

There are a handful of ways to pass environment variables to Cypress, but the most common is going to be via the [`cypress.env.json` file](https://docs.cypress.io/guides/guides/environment-variables#Option-1-configuration-file), the [env executor option for cypress](/nx-api/cypress/executors/cypress#env) or the commandline.

Create a `cypress.env.json` file in the projects root i.e. `apps/my-cool-app-e2e/cypress.env.json`. Cypress will automatically pick up this file. This method is helpful for configurations that you want to not commit. Just don't forget to add the file to the `.gitignore` and add documentation so people in your repo know what values to popluate in their local copy of the `cypress.env.json` file.

Using [@nx/cypress:cypress](/nx-api/cypress/executors/cypress) env executor option is a good way to add values you want to define that you don't mine commit to the repository, such as a base API url. You can leverage [target configurations](/reference/project-configuration#targets) to define different values as well.

Optionally, you can pass environment variables via the commandline with the `--env` flag.

{% callout type="warning" title="Executor options and --env" %}
When using the `--env` flag, this will not be merged with any values used in the `env` executor option.
{% /callout %}

```shell
nx e2e frontend-e2e --env.API_URL="https://api.my-nx-website.com" --env.API_KEY="abc-123"
```
