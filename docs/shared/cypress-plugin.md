![Cypress logo](/shared/cypress-logo.png)

Cypress is a test runner built for the modern web. It has a lot of great features:

- Time travel
- Real-time reloads
- Automatic waiting
- Spies, stubs, and clocks
- Network traffic control
- Screenshots and videos
- Component Testing

## Setting Up Cypress

If the `@nrwl/cypress` package is not installed, install the version that matches your `@nrwl/workspace` version.

```bash
yarn add --dev @nrwl/cypress
```

```bash
npm install --save-dev @nrwl/cypress
```

## E2E Testing

By default, when creating a new frontend application, Nx will use Cypress to create the e2e tests project.

```bash
nx g @nrwl/web:app frontend
```

### Creating a Cypress E2E project for an existing project

To generate an E2E project based on an existing project, run the following generator

```bash
nx g @nrwl/cypress:cypress-project your-app-name-e2e --project=your-app-name
```

Optionally, you can use the `--baseUrl` option if you don't want cypress plugin to serve `your-app-name`.

```bash
nx g @nrwl/cypress:cypress-project your-app-name-e2e --baseUrl=http://localhost:4200
```

Replace `your-app-name` with the app's name as defined in your `workspace.json` file.

### Testing Applications

Run `nx e2e frontend-e2e` to execute e2e tests with Cypress.

You can run your e2e test against a production build with the `--prod` flag

```bash
nx e2e frontend-e2e --prod
```

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/apps/frontend/screenshots` and `dist/apps/frontend/videos`.

### Watching for Changes (Headed Mode)

With, `nx e2e frontend-e2e --watch` Cypress will start in headed mode where you can see your application being tested.

Running Cypress with `--watch` is a great way to enhance dev workflow - you can build up test files with the application
running and Cypress will re-run those tests as you enhance and add to the suite.

```bash
nx e2e frontend-e2e --prod
```

### Specifying a Custom Url to Test

The `baseUrl` property provides you the ability to test an application hosted on a specific domain.

```bash
nx e2e frontend-e2e --baseUrl=https://frontend.com
```

> If no `baseUrl` and no `devServerTarget` are provided, Cypress will expect to have the `baseUrl` property in
> the cypress config file, or will error.

### Using cypress.config.ts

If you need to fine tune your Cypress setup, you can do so by modifying `cypress.config.ts` in the e2e project. For
instance,
you can easily add your `projectId` to save all the screenshots and videos into your Cypress dashboard. The complete
configuration is documented
on [the official website](https://docs.cypress.io/guides/references/configuration.html#Options).

## Component Testing

> Component testing is available on Cypress v10 and above.
> See our [migration guide for more information](/cypress/cypress-v10-migration).

Unlike E2E testing, component testing does not create a new project. Instead, Cypress component testing is added
directly to a project.

Use the frameworks specific `cypress-component-configuration` generator to set up component testing in the project.

```bash
nx g @nrwl/react:cypress-component-configuration --project=your-react-lib
```

```bash
nx g @nrwl/next:cypress-component-configuration --project=your-next-lib
```

You can optionally pass in `--generate-tests` to create component tests for all components within the library.

### Testing Projects

Run `nx component-test your-lib` to execute the component tests with Cypress.

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/libs/your-lib/screenshots` and `dist/libs/your-lib/videos`.

### Watching for Changes (Headed Mode)

With, `nx component-test your-lib --watch` Cypress will start in headed mode. Where you can see your component being tested.

Running Cypress with `--watch` is a great way to enhance dev workflow. You can iterate on the component tests and
component under test - Cypress will re-run your tests after changes to the component are made.

### Using cypress.config.ts

If you need to fine tune your Cypress setup, you can do so by modifying `cypress.config.ts` in the project root. For
instance,
you can easily add your `projectId` to save all the screenshots and videos into your Cypress dashboard. The complete
configuration is documented
on [the official website](https://docs.cypress.io/guides/references/configuration.html#Options).

## More Documentation

React Nx Tutorial

- [Step 2: Add E2E Tests](/react-tutorial/02-add-e2e-test)
- [Step 3: Display Todos](/react-tutorial/03-display-todos)

Angular Nx Tutorial

- [Step 2: Add E2E Tests](/angular-tutorial/02-add-e2e-test)
- [Step 3: Display Todos](/angular-tutorial/03-display-todos)
