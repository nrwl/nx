# Use Executor Configurations

The `configurations` property provides extra sets of values that will be merged into the options map.

```json {% fileName="project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "outputs": ["{workspaceRoot}/dist/libs/mylib"],
    "dependsOn": ["^build"],
    "options": {
      "tsConfig": "libs/mylib/tsconfig.lib.json",
      "main": "libs/mylib/src/main.ts"
    },
    "configurations": {
      "production": {
        "tsConfig": "libs/mylib/tsconfig-prod.lib.json"
      }
    }
  }
}
```

You can select a configuration like this: `nx build mylib --configuration=production`
or `nx run mylib:build:production`.

The following code snippet shows how the executor options get constructed:

```javascript
require(`@nx/jest`).executors['jest']({
  ...options,
  ...selectedConfiguration,
  ...commandLineArgs,
}); // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the
configuration options.

## Default Configuration

When using multiple configurations for a given target, it's helpful to provide a default configuration.
For example, running e2e tests for multiple environments. By default it would make sense to use a `dev` configuration for day to day work, but having the ability to run against an internal staging environment for the QA team.

```json {% fileName="project.json" %}
{
  "e2e": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/my-app-e2e/cypress.config.ts"
    },
    "configurations": {
      "dev": {
        "devServerTarget": "my-app:serve"
      },
      "qa": {
        "baseUrl": "https://some-internal-url.example.com"
      }
    },
    "defaultConfiguration": "dev"
  }
}
```

When running `nx e2e my-app-e2e`, the _dev_ configuration will be used. In this case using the local dev server for `my-app`.
You can always run the other configurations by explicitly providing the configuration i.e. `nx e2e my-app-e2e --configuration=qa` or `nx run my-app-e2e:e2e:qa`
