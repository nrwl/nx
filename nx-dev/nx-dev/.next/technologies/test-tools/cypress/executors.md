
  The @nx/cypress plugin provides various executors to help you create and configure cypress projects within your Nx workspace.
Below is a complete reference for all available executors and their options.

### `cypress`
Run Cypress for e2e, integration and component testing.

Depending on your testing type, the Cypress executor is configured in different ways. The following are sample configurations that are created via the [configuration](/nx-api/cypress/generators/configuration) and [component-configuration](/nx-api/cypress/generators/component-configuration) generators.

###### E2E Testing

```json
"targets": {
  "e2e": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/app-e2e/cypres.config.ts",
      "devServerTarget": "my-react-app:serve",
      "testingType": "e2e"
    }
  }
}
```

:::note[API Testing]
API testing with Cypress is the same setup as e2e testing. Just change which `devServerTarget` is used!
:::

#### Providing a Base URL

If `devServerTarget` is provided, the url returned from started the dev server will be passed to cypress as the `baseUrl` option.

Defining a `baseUrl` in the executor options will override the inferred `baseUrl` from the `devServerTarget`.

The `baseUrl` defined in the Cypress config file is the last value used if no url is found in the `devServerTarget` or executor options.

#### Static Serving

When running in CI it doesn't make sense to start up a dev server since there aren't changes to watch for.

You can use [`@nx/web:file-server`](/nx-api/web/executors/file-server) to serve the pre-built static files of your frontend project.

In some _frontend_ application, add a 'static-serve' target.

```json
"serve-static": {
  "executor": "@nx/web:file-server",
  "options":{
    "buildTarget": "frontend:build"
  }
}
```

In the _e2e_ application add a configuration to change `devServerTarget` to point to the `static-serve` from the _frontend_ application

```json
"e2e": {
  //...
  "configurations": {
    "ci": {
      "devServerTarget": "frontend:serve-static"
    }
  }
}
```

:::note[What about Node projects?]
The same can be done for backend node apps with [`@nx/js:node` executor](/nx-api/js/executors/node)
:::

```bash
nx e2e my-app-e2e
```

###### Component Testing

:::note[Cypress Component Testing]
When adding component testing to a project, it's best to use the framework specific generator, instead `cypress-component-project` directly.

- [React component testing](/nx-api/react/generators/cypress-component-configuration)
- [Angular component testing](/nx-api/angular/generators/cypress-component-configuration)
  :::

```json
"targets": {
  "component-test": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/app/cypres.config.ts",
      "devServerTarget": "my-react-app:build",
      "testingType": "component",
      "skipServe": true
    }
  }
}
```

It's important `skipServe` is set to true. Nx doesn't need to run the `devServerTarget`, Cypress creates its own dev server for component testing.
Instead, Nx needs to know what build target to create the correct configuration to pass to Cypress, which is why it's still used in component testing.

#### Environment Variables

Using [executor configurations](/concepts/executors-and-configurations#executors-and-configurations) offers flexibility to set environment variables

```json
"targets": {
  "e2e": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/app-e2e/cypres.config.ts",
      "devServerTarget": "my-react-app:serve",
      "testingType": "e2e"
    },
    "configurations": {
      "qa": {
        "env": {
          "API_URL": "https://api.qa.company.com"
        }
      },
      "dev": {
        "env": {
          "API_URL": "http://localhost:3333/api"
        }
      }
    }
  }
}
```

Read more on different ways to use [environment variables for cypress executor](/nx-api/cypress#environment-variables)
#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `cypressConfig` | string [**required**] | The path of the Cypress configuration json file. |  |
| `autoCancelAfterFailures` | string | Specify the number of failures to cancel a run being recorded to the Cypress Cloud or `false` to disable auto-cancellation. |  |
| `baseUrl` | string | The address (with the port) which your application is running on. |  |
| `browser` | string | The browser to run tests in. |  |
| `ciBuildId` | string | A unique identifier for a run to enable grouping or parallelization. |  |
| `devServerTarget` | string | Dev server target to run tests against. |  |
| `env` | object | A key-value Pair of environment variables to pass to Cypress runner. |  |
| `exit` | boolean | Whether or not the Cypress Test Runner will stay open after running tests in a spec file. | `true` |
| `group` | string | A named group for recorded runs in the Cypress dashboard. |  |
| `headed` | boolean | Displays the browser instead of running headlessly. Set this to `true` if your run depends on a Chrome extension being loaded. | `false` |
| `headless` | boolean | Hide the browser instead of running headed. | `false` |
| `ignoreTestFiles` | string | A String or Array of glob patterns used to ignore test files that would otherwise be shown in your list of tests. Cypress uses minimatch with the options: `{dot: true, matchBase: true}`. We suggest using https://globster.xyz to test what files would match. |  |
| `key` | string | The key cypress should use to run tests in parallel/record the run (CI only). |  |
| `parallel` | boolean | Whether or not Cypress should run its tests in parallel (CI only). | `false` |
| `port` | string | Pass a specified port value to the devServerTarget, if the value is 'cypress-auto' a free port will automatically be picked for the devServerTarget. |  |
| `quiet` | boolean | If passed, Cypress output will not be printed to stdout. Only output from the configured Mocha reporter will print. | `false` |
| `record` | boolean | Whether or not Cypress should record the results of the tests. | `false` |
| `reporter` | string | The reporter used during cypress run. |  |
| `reporterOptions` | string | The reporter options used. Supported options depend on the reporter. https://docs.cypress.io/guides/tooling/reporters#Reporter-Options |  |
| `runnerUi` | boolean | Displays the Cypress Runner UI. Useful for when Test Replay is enabled and you would still like the Cypress Runner UI to be displayed for screenshots and video. |  |
| `skipServe` | boolean | Skip dev-server build. | `false` |
| `spec` | string | A comma delimited glob string that is provided to the Cypress runner to specify which spec files to run. i.e. `**examples/**,**actions.spec**`. |  |
| `tag` | string | A comma delimited list to identify a run with. |  |
| `testingType` | string | Specify the type of tests to execute. | `"e2e"` |
| `watch` | boolean | Recompile and run tests when files change. | `false` |
