This is a generator to add a cypress e2e configuration to an existing project.

```bash
nx g cypress-e2e-configuration --project=my-cool-project --devServerTarget=some-app:serve
```

Running this generator, adds the required files to run cypress tests for a project,
Mainly a `cypress.config.ts` file and default files in the `<project-root>/cypress/` directory.
Tests will be located in `<project-root>/cypress/e2e/*` by default.

You can customize the directory used via the `--directory` flag, the value is relative to the project root.

For example if you wanted to place the files inside an `e2e` folder

```bash
nx g cypress-e2e-configuration --project=my-cool-project --devServerTarget=some-app:serve --directory=e2e
```

Providing a `--devServerTarget` is optional if you provide a `--baseUrl` or the project you're adding the configuration to has a `serve` target already.
Otherwise, a `--devServerTarget` is recommend for the `@nx/cypress:cypress` executor to spin up the dev server for you automatically when needed.

## Feature Based Testing

This generator helps in creating feature based e2e/integration testing setups where you can place the feature tests in the same project as the feature library.
This differs from creating a separate e2e project that contained all tests for an application which can easily cause more tests to run than is strictly necessary.

Take the following workspace where the `feature-cart` project is affected.

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "type": "app",
      "name": "fancy-app",
      "data": {
        "tags": []
      }
    },
    {
      "type": "app",
      "name": "fancy-app-e2e",
      "data": {
        "tags": []
      }
    },
    {
      "type": "lib",
      "name": "feature-user",
      "data": {
        "tags": []
      }
    },
    {
      "type": "lib",
      "name": "feature-dashboard",
      "data": {
        "tags": []
      }
    },
    {
      "type": "lib",
      "name": "feature-cart",
      "data": {
        "tags": []
      }
    }
  ],
  "groupByFolder": false,
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "dependencies": {
    "fancy-app": [
      {
        "target": "feature-user",
        "source": "fancy-app",
        "type": "static"
      },
      {
        "target": "feature-cart",
        "source": "fancy-app",
        "type": "static"
      }
    ],
    "fancy-app-e2e": [
      {
        "target": "fancy-app",
        "source": "fancy-app-e2e",
        "type": "implicit"
      }
    ],
    "feature-user": [
      {
        "target": "feature-dashboard",
        "source": "feature-user",
        "type": "direct"
      }
    ],
    "feature-cart": [],
    "feature-dashboard": []
  },
  "affectedProjectIds": ["feature-cart", "fancy-app", "fancy-app-e2e"]
}
```

{% /graph %}

In this case, if tests for the all the `feature-*` projects where contained in the `fancy-app-e2e` project, then all of those features will be tested in the app, when only the `feature-cart` tests need to run.

Running these e2e/integration tests more often than they should results in longer CI times.

Brining those e2e test closer to each feature can result is lowering CI times since we don't need to test those features if they did not change.

Building this way leaves the `fancy-app-e2e` for mostly smoke type testing instead of more in-depth feature testing.

Using the `cypress-e2e-configuration` generator can help you accomplish this in your workspace.

```bash
nx g cypress-e2e-configuration --project=feature-cart --devServerTarget=fancy-app:serve
nx g cypress-e2e-configuration --project=feature-user --devServerTarget=fancy-app:serve
nx g cypress-e2e-configuration --project=feature-dashboard --devServerTarget=fancy-app:serve
```

Each project will now get their own `e2e` target, where the feature project is only concerned with itself. This allows for more focused tests without worrying about forcing unrelated tests to also run.

It's important to remember that these feature tests are still going to be leveraging the same app to run the tests against so if you plan to run in parallel, you can leverage using a file server and the ability for `@nx/cypress:cypress` executor to pass through a port or find a free port to allow running tests in parallel. Read more [about the --port flag](/packages/cypress/executors/cypress#port)
