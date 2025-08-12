---
title: Overview of the Nx Cypress Plugin
description: The Nx Plugin for Cypress contains executors and generators that support e2e testing with Cypress. This page also explains how to configure Cypress on your Nx workspace.
---

# @nx/cypress

Cypress is a test runner built for the modern web. It has a lot of great features:

- Time travel
- Real-time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

## Setting Up @nx/cypress

> Info about [Cypress Component Testing can be found here](/technologies/test-tools/cypress/recipes/cypress-component-testing)

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

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/cypress` package with your package manager.

```shell
npm add -D @nx/cypress
```

{% /tab %}
{% /tabs %}

### How @nx/cypress Infers Tasks

{% callout type="note" title="Inferred Tasks" %}
Since Nx 18, Nx plugins can infer tasks for your projects based on the configuration of different tools. You can read more about it at the [Inferred Tasks concept page](/concepts/inferred-tasks).
{% /callout %}

The `@nx/cypress` plugin will create a task for any project that has a Cypress configuration file present. Any of the following files will be recognized as a Cypress configuration file:

- `cypress.config.js`
- `cypress.config.ts`
- `cypress.config.mjs`
- `cypress.config.cjs`

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
        "targetName": "e2e",
        "ciTargetName": "e2e-ci",
        "componentTestingTargetName": "component-test",
        "openTargetName": "open-cypress"
      }
    }
  ]
}
```

The `targetName`, `ciTargetName`, `componentTestingTargetName`, and `open-cypress` options control the names of the inferred Cypress tasks. The default names are `e2e`, `e2e-ci`, `component-test`, and `open-cypress`.

### Splitting E2E tasks by file

The `@nx/cypress/plugin` will automatically split your e2e tasks by file. You can read more about the Atomizer feature [here](/ci/features/split-e2e-tasks).

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

{% callout type="note" title="Using setupNodeEvents function" %}
If you use the `setupNodeEvents` function in your Cypress configuration, make sure to invoke the same function that is returned by `nxE2EPreset`. See the recipe on [using `setupNodeEvents` with Cypress preset](/technologies/test-tools/cypress/recipes/cypress-setup-node-events) for more details.
{% /callout %}

## E2E Testing

By default, when creating a new frontend application, Nx will use Cypress to create the e2e tests project.

```shell
nx g @nx/web:app apps/frontend
```

### Configure Cypress for an existing project

To configure Cypress for an existing project, run the following generator:

```shell
nx g @nx/cypress:configuration --project=your-app-name
```

Optionally, you can use the `--baseUrl` option if you don't want the Cypress plugin to serve `your-app-name`.

```shell
nx g @nx/cypress:configuration --project=your-app-name --baseUrl=http://localhost:4200
```

Replace `your-app-name` with the app's name as defined in your `project.json` file or the `name` property of your `package.json`.

{% callout type="note" title="E2E setup location" %}
The `@nx/cypress:configuration` generator is not a project generator. It won't generate a separate project for the E2E tests. It will configure Cypress for the provided project.

To set up a separate project, you can generate a separate project with a project generator like `@nx/js:library` first and then run the `@nx/cypress:configuration` generator.
{% /callout %}

### Testing Applications

Run `nx e2e frontend-e2e` to execute e2e tests with Cypress.

You can run your e2e test against a production build by using the `production` [configuration](/concepts/executors-and-configurations#use-task-configurations)

```shell
nx e2e frontend-e2e --configuration=production
```

You can use the `--spec` flag to glob for test files.

```shell
# run the tests in the smoke/ directory
nx e2e frontend-e2e --spec="**smoke/**"

# run the tests in smoke/ directory and with dashboard in the file name
nx e2e frontend-e2e --spec="**smoke/**,**dashboard.cy**"
```

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/cypress/apps/frontend/screenshots` and `dist/cypress/apps/frontend/videos`.

### Watching for Changes (Headed Mode)

You can also run Cypress in headed mode and watching for changes. This is a great way to enhance the dev workflow. You can build up test files with the application
running and Cypress will re-run those tests as you enhance and add to the suite.

{% tabs %}
{% tab label="Using inferred tasks" %}

```shell
nx open-cypress frontend-e2e
```

{% /tab %}

{% tab label="Using the @nx/cypress:cypress executor" %}

```shell
nx e2e frontend-e2e --watch
```

{% /tab %}
{% /tabs %}

### Specifying a Custom Url to Test

The `baseUrl` property provides you the ability to test an application hosted on a specific domain.

{% tabs %}
{% tab label="Using inferred tasks" %}

```shell
nx e2e frontend-e2e --config="baseUrl=https://frontend.com"
```

{% callout type="note" title="Required options" %}
If `baseUrl` is not provided, Cypress will expect to have the `baseUrl` property in its config file. Otherwise, it will error.
{% /callout %}

{% /tab %}

{% tab label="Using the @nx/cypress:cypress executor" %}

```shell
nx e2e frontend-e2e --baseUrl=https://frontend.com
```

{% callout type="note" title="Required options" %}
If no `baseUrl` and no `devServerTarget` are provided, Cypress will expect to have the `baseUrl` property in its config file. Otherwise, it will error.
{% /callout %}

{% /tab %}
{% /tabs %}

## Using cypress.config.ts

If you need to fine tune your Cypress setup, you can do so by modifying `cypress.config.ts` in the project root. For
instance,
you can easily add your `projectId` to save all the screenshots and videos into your Cypress dashboard. The complete
configuration is documented
on [the official website](https://docs.cypress.io/guides/references/configuration.html#Options).

For adding more dynamic configurations to your Cypress configuration, you can look into using [setupNodeEvents](https://docs.cypress.io/api/plugins/browser-launch-api#Syntax) configuration option.

## Environment Variables

If you need to pass a variable to Cypress that you don't want to commit to your repository (i.e. API keys, dynamic values based on configurations, API URLs), you can use [Cypress environment variables](https://docs.cypress.io/guides/guides/environment-variables).

There are a handful of ways to pass environment variables to Cypress, but the most common is going to be via the [`cypress.env.json` file](https://docs.cypress.io/guides/guides/environment-variables#Option-1-configuration-file), the `-e` Cypress arg or the `env` option from the `@nx/cypress:cypress` executor in the [project configuration](/reference/project-configuration#task-definitions-targets) or the command line.

Create a `cypress.env.json` file in the projects root (i.e. `apps/my-cool-app-e2e/cypress.env.json`). Cypress will automatically pick up this file. This method is helpful for configurations that you don't want to commit. Just don't forget to add the file to the `.gitignore` and add documentation so people in your repo know what values to populate in their local copy of the `cypress.env.json` file.

Setting the `-e` Cypress arg or the `env` option from the `@nx/cypress:cypress` executor in the project configuration is a good way to add values you want to define that you don't mind committing to the repository, such as a base API URL.

{% tabs %}
{% tab label="Using inferred tasks" %}

```json {% fileName="project.json" %}
{
  ...
  "targets": {
    "e2e": {
      "options": {
        "args": "--env=API_URL=https://api.my-nx-website.com"
      }
    }
  }
}
```

{% /tab %}

{% tab label="Using the @nx/cypress:cypress executor" %}

```json {% fileName="project.json" %}
{
  ...
  "targets": {
    "e2e": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "env": "API_URL=https://api.my-nx-website.com"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

Finally, you can also pass environment variables via the command line with the `-e` Cypress arg or the `--env` option for the `@nx/cypress:cypress` executor.

{% tabs %}
{% tab label="Using inferred tasks" %}

```shell
nx e2e frontend-e2e -e=API_URL=https://api.my-nx-website.com,API_KEY=abc-123
```

{% /tab %}

{% tab label="Using the @nx/cypress:cypress executor" %}

```shell
nx e2e frontend-e2e --env.API_URL="https://api.my-nx-website.com" --env.API_KEY="abc-123"
```

{% /tab %}
{% /tabs %}

{% callout type="warning" title="Command-line args vs configuration options" %}
Providing a flag will override any option with the same name set in the project or workspace configuration.
{% /callout %}
