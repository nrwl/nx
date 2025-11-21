This is a generator to add a cypress e2e configuration to an existing project.

```bash
nx g @nx/cypress:configuration --project=my-cool-project --devServerTarget=some-app:serve
```

Running this generator, adds the required files to run cypress tests for a project,
Mainly a `cypress.config.ts` file and default files in the `<project-root>/cypress/` directory.
Tests will be located in `<project-root>/cypress/e2e/*` by default.

You can customize the directory used via the `--directory` flag, the value is relative to the project root.

For example if you wanted to place the files inside an `e2e` folder

```bash
nx g @nx/cypress:configuration --project=my-cool-project --devServerTarget=some-app:serve --directory=e2e
```

Providing a `--devServerTarget` is optional if you provide a `--baseUrl` or the project you're adding the configuration to has a `serve` target already.
Otherwise, a `--devServerTarget` is recommend for the `@nx/cypress:cypress` executor to spin up the dev server for you automatically when needed.
