{% callout type="caution" title="Can I use component testing?" %}
Angular component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v11 via the [migrate-to-cypress-11 generator](/nx-api/cypress/generators/migrate-to-cypress-11).

This generator is for Cypress based component testing.

If you want to test components via Storybook with Cypress, then check out the [storybook-configuration generator docs](/nx-api/angular/generators/storybook-configuration). However, this functionality is deprecated, and will be removed on Nx version 18.
{% /callout %}

This generator is designed to get your Angular project up and running with Cypress Component Testing.

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project
```

Running this generator, adds the required files to the specified project with a preconfigured `cypress.config.ts` designed for Nx workspaces.

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename),
});
```

Here is an example on how to add custom options to the configuration

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/angular/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // extra options here
  },
});
```

## Specifying a Build Target

Component testing requires a _build target_ to correctly run the component test dev server. This option can be manually specified with `--build-target=some-angular-app:build`, but Nx will infer this usage from the [project graph](/concepts/mental-model#the-project-graph) if one isn't provided.

For Angular projects, the build target needs to be using the `@nx/angular:webpack-browser` or
`@angular-devkit/build-angular:browser` executor.
The generator will throw an error if a build target can't be found and suggest passing one in manually.

Letting Nx infer the build target by default

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project
```

Manually specifying the build target

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project --build-target:some-angular-app:build --generate-tests
```

{% callout type="note" title="Build Target with Configuration" %}
If you're wanting to use a build target with a specific configuration. i.e. `my-app:build:production`,
then manually providing `--build-target=my-app:build:production` is the best way to do that.
{% /callout %}

## Auto Generating Tests

You can optionally use the `--generate-tests` flag to generate a test file for each component in your project.

```shell
nx g @nx/angular:cypress-component-configuration --project=my-cool-angular-project --generate-tests
```

## Running Component Tests

A new `component-test` target will be added to the specified project to run your component tests.

```shell
nx g component-test my-cool-angular-project
```

Here is an example of the project configuration that is generated. The `--build-target` option is added as the `devServerTarget` which can be changed as needed.

```json {% fileName="project.json" %}
{
  "targets" {
    "component-test": {
      "executor": "@nx/cypress:cypress",
      "options": {
        "cypressConfig": "<path-to-project-root>/cypress.config.ts",
        "testingType": "component",
        "devServerTarget": "some-angular-app:build",
        "skipServe": true
      }
    }
  }
}
```

## What is bundled

When the project being tested is a dependent of the specified `--build-target`, then **assets, scripts, and styles** are applied to the component being tested. You can determine if the project is dependent by using the [project graph](/features/explore-graph). If there is no link between the two projects, then the **assets, scripts, and styles** won't be included in the build; therefore, they will not be applied to the component. To have a link between projects, you can import from the project being tested into the specified `--build-target` project, or set the `--build-target` project to [implicitly depend](/reference/project-configuration#implicitdependencies) on the project being tested.

Nx also supports [React component testing](/nx-api/react/generators/cypress-component-configuration).
