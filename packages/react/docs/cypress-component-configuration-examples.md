{% callout type="caution" title="Can I use component testing?" %}
React component testing with Nx requires **Cypress version 10.7.0** and up.

You can migrate with to v10 via the [migrate-to-cypress-10 generator](/packages/cypress/generators/migrate-to-cypress-10).

This generator is for Cypress based component testing.

If you want to test components via Storybook with Cypress, then check out the [storybook-configuration generator docs](/packages/react/generators/storybook-configuration)
{% /callout %}

This generator is designed to get your React project up and running with Cypress Component Testing.

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project
```

Running this generator, adds the required files to the specified project with a preconfigured `cypress.config.ts` designed for Nx workspaces.

The following file will be added to projects where the Component Testing build target is using `webpack` for bundling:

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, {
    bundler: 'webpack',
  }),
});
```

The following file will be added to projects where the Component Testing build target is using `vite` for bundling:

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: nxComponentTestingPreset(__filename, {
    bundler: 'vite',
  }),
});
```

Here is an example on how to add custom options to the configuration

```ts {% fileName="cypress.config.ts" %}
import { defineConfig } from 'cypress';
import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';

export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename, {
      bundler: 'webpack',
    }),
    // extra options here
  },
});
```

## The `bundler` option

Component testing supports two different bundlers: `webpack` and `vite`. The Nx generator will pick up the bundler used in the specified project's build target. If the build target is using `@nx/webpack:webpack`, then the generator will use `webpack` as the bundler. If the build target is using `@nx/vite:build`, then the generator will use `vite` as the bundler.

You can manually set the bundler by passing `--bundler=webpack` or `--bundler=vite` to the generator, but that is not needed since the generator will pick up the correct bundler for you. However, if you want to use a different bundler than the one that is used in the build target, then you can manually set it using that flag.

## Specifying a Build Target

Component testing requires a _build target_ to correctly run the component test dev server. This option can be manually specified with `--build-target=some-react-app:build`, but Nx will infer this usage from the [project graph](/concepts/mental-model#the-project-graph) if one isn't provided.

For React projects, the build target needs to be using the `@nx/webpack:webpack` executor.
The generator will throw an error if a build target can't be found and suggest passing one in manually.

Letting Nx infer the build target by default

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project
```

Manually specifying the build target

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project --build-target:some-react-app:build --generate-tests
```

{% callout type="note" title="Build Target with Configuration" %}
If you're wanting to use a build target with a specific configuration. i.e. `my-app:build:production`,
then manually providing `--build-target=my-app:build:production` is the best way to do that.
{% /callout %}

## Auto Generating Tests

You can optionally use the `--generate-tests` flag to generate a test file for each component in your project.

```shell
nx g @nx/react:cypress-component-configuration --project=my-cool-react-project --generate-tests
```

## Running Component Tests

A new `component-test` target will be added to the specified project to run your component tests.

```shell
nx g component-test my-cool-react-project
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
        "devServerTarget": "some-react-app:build",
        "skipServe": true
      }
    }
  }
}
```

Nx also supports [Angular component testing](/packages/angular/generators/cypress-component-configuration).
