Depending on your testing type, the Cypress executor is configured in different ways. The following are sample configurations that are created via the [configuration](/nx-api/cypress/generators/configuration) and [component-configuration](/nx-api/cypress/generators/component-configuration) generators.

{% tabs %}
{% tab label="E2E Testing" %}

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

{% callout type="note" title="API Testing" %}
API testing with Cypress is the same setup as e2e testing. Just change which `devServerTarget` is used!
{% /callout %}

### Providing a Base URL

If `devServerTarget` is provided, the url returned from started the dev server will be passed to cypress as the `baseUrl` option.

Defining a `baseUrl` in the executor options will override the inferred `baseUrl` from the `devServerTarget`.

The `baseUrl` defined in the Cypress config file is the last value used if no url is found in the `devServerTarget` or executor options.

### Static Serving

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

{% callout type="note" title="What about Node projects?" %}
The same can be done for backend node apps with [`@nx/js:node` executor](/nx-api/js/executors/node)
{% /callout %}

```bash
nx e2e my-app-e2e
```

{% /tab %}
{% tab label="Component Testing" %}

{% callout type="note" title="Cypress Component Testing" %}
When adding component testing to a project, it's best to use the framework specific generator, instead `cypress-component-project` directly.

- [React component testing](/nx-api/react/generators/cypress-component-configuration)
- [Angular component testing](/nx-api/angular/generators/cypress-component-configuration)

{% /callout %}

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

{% /tab %}
{% /tabs %}

### Environment Variables

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
