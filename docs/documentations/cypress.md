# What is Cypress?

Cypress is an open source e2e test runner that is very efficient and gives you a modern e2e testing experience. It is used within Slack internally as well as many other enterprises and open source projects including Nrwl projects!

## Reasons for Using Cypress

Cypress is architecturally different from tools like Selenium. Many things that are challenging with Selenium are straightforward using Cypress.
It provides:

- Time Travel
- Debuggability
- Automatic Waiting
- Spies, Stubs, and Clocks
- Network Traffic Control
- Consistent Results
- Screenshots and Videos

## How to use Cypress

### Generating an application which uses Cypress

To start using Cypress, you need to provide the `--e2e-test-runner=cypress` option when creating a new application.

```
ng generate application myApp --e2e-test-runner=cypress
```

> Unfortunately, the cypress api and its ecosystem are different from Protractor. So Nx cannot provide a reliable migration from Protractor to Cypress tests in an existing application.

### Testing an application which uses Cypress

Testing a project using Cypress within the Nx Workspace is almost identical to testing any other project. Use the following command to execute the e2e tests in the `applicationName` application:

```
ng e2e my-app-e2e
```

By default, Cypress will run in the terminal but “headed” (you will see the tests executing in a new browser window), using the default browser to perform all the specs as Protractor does it. You will have the result of all the tests and errors (if any) in your terminal.

Screenshots and Videos will be accessible respectively in `/dist/apps/my-app-e2e/screenshots` and `/dist/apps/my-app-e2e/videos` by default.

### Watching for changes

With, `ng e2e my-app-e2e --watch` Cypress will start in the application mode.

Typescript will watch your spec files and recompile; Cypress will then run the new tests automatically. If you make changes in your application, the tests are triggered to run again automatically.

### Watching for changes (headless)

With, `ng e2e my-app-e2e --watch --headless` Cypress will start in the terminal in _headless_ mode. Everything will happen in the terminal and you will not be bothered by any browser window. You will be able to focus on your tests.

### Using Cypress headlessly (CI)

If you want to run the Cypress tests in headless mode (while being on CI for example), you can do so by passing `--headless` to the command. You will see all the test results live in the terminal. Videos and screenshot will be available for debugging.

```
ng e2e my-app-e2e --headless
```

### Test specific targeted build

You can run your e2e test against a production build too with `--prod`, by doing the following:

```
ng e2e my-app-e2e --prod
```

### Specifying a custom url to test

The `baseUrl` property provides you the ability to test an application hosted on a specific domain.

```
ng e2e my-app-e2e --baseUrl=https://my-app.com
```

> If no `baseUrl` and no `devServerTarget` are provided, Cypress will expect to have the `baseUrl` property in the `cypress.json` file, or will error.

## Deeper configuration (cypress.json)

Nx respects the way Cypress intends to normally work; it uses project configuration. If you need to fine-tune the options, you can do so by modifying the `cypress.json` file in the related project. You can easily add your `projectId` to save all the screenshot and video into your Cypress dashboard. The complete configuration is documented on [the official website](https://docs.cypress.io/guides/references/configuration.html#Options).
