---
title: Cypress Component Testing
description: Learn how to set up and use Cypress component testing in your Nx workspace for React, Angular, and Next.js projects, including configuration and test execution.
---

# Cypress Component Testing

> Component testing requires Cypress v10 and above.
> See our [guide for more information](/technologies/test-tools/cypress/recipes/cypress-v11-migration) to migrate to Cypress v10.

Unlike [E2E testing](/technologies/test-tools/cypress/introduction), component testing does not create a new project. Instead, Cypress component testing is added
directly to a project, like [Jest](/technologies/test-tools/jest/introduction)

## Add Component Testing to a Project

> Currently only [@nx/react](/technologies/react/api/generators/cypress-component-configuration), [@nx/angular](/technologies/angular/api/generators/cypress-component-configuration), and [@nx/next](/technologies/react/next/api/generators/cypress-component-configuration) plugins support component testing

Use the `cypress-component-configuration` generator from the respective plugin to add component testing to a project.

```shell
nx g @nx/react:cypress-component-configuration --project=your-project

nx g @nx/angular:cypress-component-configuration --project=your-project

nx g @nx/next:cypress-component-configuration --project=your-project
```

You can optionally pass in `--generate-tests` to create component tests for all components within the library.

Component testing supports both applications and libraries. By default, the generator attempts to find the build target for you based on the project's dependent apps. But you can manually specify the build target to use via the `--build-target` option. Note, in most cases, the build target will be from a different project than the one being configured. The only case where the build targets are from the same project is when the component tests are being added to an application.

> Note: The [@nx/next:cypress-component-configuration generator](/technologies/react/next/api/generators/cypress-component-configuration) doesn't require a build target

```shell
nx g @nx/react:cypress-component-configuration --project=your-project --build-target=my-react-app:build

nx g @nx/angular:cypress-component-configuration --project=your-project --build-target=my-ng-app:build
```

The build target option can be changed later via updating the `devServerTarget` option in the `component-test` target.

{% callout type="warning" title="Executor Options" %}
When using component testing make sure to set `skipServe: true` in the component test target options, otherwise `@nx/cypress` will attempt to run the build first which can slow down your component tests. `skipServe: true` is automatically set when using the `cypress-component-configuration` generator.
{% /callout %}

## Configuration

When using the `cypress-component-configuration` generator, a helper function is used in the `cypress.config.ts` to setup the ideal settings for your project.

If you need to add additional configuration properties, you can spread the returned object from the helper function.

```ts {%filename="cypress.config.ts"}
export default defineConfig({
  component: {
    ...nxComponentTestingPreset(__filename),
    // add your own config here
  },
});
```

## Testing Projects

Run `nx component-test your-lib` to execute the component tests with Cypress.

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/cypress/libs/your-lib/screenshots` and `dist/cypress/libs/your-lib/videos`.

## Watching for Changes (Headed Mode)

With, `nx component-test your-lib --watch` Cypress will start in headed mode. Where you can see your component being tested.

Running Cypress with `--watch` is a great way to iterate on your components since cypress will rerun your tests as you make those changes validating the new behavior.

## Splitting Component Testing Tasks by File

{% callout type="note" title="Available since Nx 21.6.1" %}
Splitting component testing tasks by file is available since Nx 21.6.1.
{% /callout %}

Nx provides powerful features for [distributing tasks in CI](/ci/features/distribute-task-execution), including [splitting tasks by file](/ci/features/split-e2e-tasks) (also known as atomization). The `@nx/cypress` plugin facilitates this for Cypress projects, allowing you to run your tests more efficiently in your Continuous Integration (CI) environment.

To enable component testing task splitting, set the `ciComponentTestingTargetName` option of the `@nx/cypress/plugin` in your `nx.json` file. It will look something like this:

```json {% fileName="nx.json" highlightLines=[9] %}
{
  "plugins": [
    {
      "plugin": "@nx/cypress/plugin",
      "options": {
        "targetName": "e2e",
        "ciTargetName": "e2e-ci",
        "componentTestingTargetName": "component-test",
        "ciComponentTestingTargetName": "component-test-ci",
        "openTargetName": "open-cypress"
      }
    }
  ]
}
```

The plugin will infer the `component-test-ci` task, which depends on individual component testing tasks for each file. You can then replace the `component-test` task with the `component-test-ci` task in your CI configuration to run your tests in a distributed fashion:

```diff {% fileName=".github/workflows/ci.yaml" %}
-     - run: pnpm exec nx affected -t lint test build component-test
+     - run: pnpm exec nx affected -t lint test build component-test-ci
```

You can read more about the Atomizer feature [here](/ci/features/split-e2e-tasks).

## More Information

You can read more on component testing in the [Cypress documentation](https://docs.cypress.io/guides/component-testing/writing-your-first-component-test).
