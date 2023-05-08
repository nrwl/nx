{% callout type="caution" title="Can I use component testing?" %}
Next component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v10 via the [migrate-to-cypress-11 generator](/packages/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you want to test components via Storybook with Cypress, then check out the [storybook-configuration generator docs](/packages/react/generators/storybook-configuration)
{% /callout %}

This generator is designed to get your Next project up and running with Cypress Component Testing.

```shell
nx g @nx/next:cypress-component-configuration --project=my-cool-next-project
```

Running this generator, adds the required files to the specified project with a preconfigured `cypress.config.ts` designed for Nx workspaces.

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
```

Here is an example on how to add custom options to the configuration

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/next/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // extra options here
  },
});
```

```shell
nx g @nx/next:cypress-component-project --project=my-cool-next-project
```

## Auto Generating Tests

You can optionally use the `--generate-tests` flag to generate a test file for each component in your project.

```shell
nx g @nx/next:cypress-component-configuration --project=my-cool-next-project --generate-tests
```

## Running Component Tests

A new `component-test` target will be added to the specified project to run your component tests.

```shell
nx g component-test my-cool-next-project
```

Here is an example of the project configuration that is generated.

```json {% fileName="project.json" %}
{
  "targets" {
    "component-test": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "<path-to-project-root>/cypress.config.ts",
        "testingType": "component",
        "skipServe": true
      }
    }
  }
}
```

Nx also supports [Angular component testing](/packages/angular/generators/cypress-component-configuration).
