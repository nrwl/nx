Cypress is a test runner built for the modern web. It has a lot of great features:

- Time travel
- Real-time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos

## Setting Up Cypress

> Info about [Cypress Component Testing can be found here](/cypress/cypress-component-testing)

If the `@nrwl/cypress` package is not installed, install the version that matches your `nx` package version.

```shell
yarn add --dev @nrwl/cypress
```

```shell
npm install --save-dev @nrwl/cypress
```

## E2E Testing

By default, when creating a new frontend application, Nx will use Cypress to create the e2e tests project.

```shell
nx g @nrwl/web:app frontend
```

### Creating a Cypress E2E project for an existing project

To generate an E2E project based on an existing project, run the following generator

```shell
nx g @nrwl/cypress:cypress-project your-app-name-e2e --project=your-app-name
```

Optionally, you can use the `--baseUrl` option if you don't want cypress plugin to serve `your-app-name`.

```shell
nx g @nrwl/cypress:cypress-project your-app-name-e2e --baseUrl=http://localhost:4200
```

Replace `your-app-name` with the app's name as defined in your `tsconfig.base.json` file or the `name` property of your `package.json`.

### Testing Applications

Run `nx e2e frontend-e2e` to execute e2e tests with Cypress.

You can run your e2e test against a production build by using the `production` [configuration](https://nx.dev/recipe/use-executor-configurations#use-executor-configurations)

```shell
nx e2e frontend-e2e --configuration=production
```

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

## Environment Variables

If you're needing to pass a variable to cypress that you wish to not commit to your repository, i.e. API keys, or dynamic values based on configurations, i.e. API Urls. This is where [Cypress environment variables](https://docs.cypress.io/guides/guides/environment-variables) can be used.

There are a handful of ways to pass environment variables to Cypress, but the most common is going to be via the [`cypress.env.json` file](https://docs.cypress.io/guides/guides/environment-variables#Option-1-configuration-file), the [env executor option for cypress](https://nx.dev/packages/cypress/executors/cypress#env) or the commandline.

Create a `cypress.env.json` file in the projects root i.e. `apps/my-cool-app-e2e/cypress.env.json`. Cypress will automatically pick up this file. This method is helpful for configurations that you want to not commit. Just don't forget to add the file to the `.gitignore` and add documentation so people in your repo know what values to popluate in their local copy of the `cypress.env.json` file.

Using [@nrwl/cypress:cypress](/packages/cypress/executors/cypress) env executor option is a good way to add values you want to define that you don't mine commit to the repository, such as a base API url. You can leverage [target configurations](/reference/project-configuration#targets) to define different values as well.

Optionally, you can pass environment variables via the commandline with the `--env` flag.

{% callout type="warning" title="Executor options and --env" %}
When using the `--env` flag, this will not be merged with any values used in the `env` executor option.
{% /callout %}

```shell
nx e2e frontend-e2e --env.API_URL="https://api.my-nx-website.com" --env.API_KEY="abc-123"
```
