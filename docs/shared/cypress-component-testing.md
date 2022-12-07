# Cypress Component Testing

> Component testing requires Cypress v10 and above.
> See our [guide for more information](/cypress/v11-migration-guide) to migrate to Cypress v10.

Unlike [E2E testing](/packages/cypress), component testing does not create a new project. Instead, Cypress component testing is added
directly to a project, like [Jest](/packages/jest)

## Add Component Testing to a Project

> Currently only [@nrwl/react](/packages/react/generators/cypress-component-configuration) and [@nrwl/angular](/packages/angular/generators/cypress-component-configuration) plugins support component testing

Use the `cypress-component-configuration` generator from the respective plugin to add component testing to a project.

```shell
nx g @nrwl/react:cypress-component-configuration --project=your-project

nx g @nrwl/angular:cypress-component-configuration --project=your-project
```

You can optionally pass in `--generate-tests` to create component tests for all components within the library.

Component testing leverages a build target within your workspace as the base for running the tests. The build target is usually an app within the workspace. By default, the generator attempts to find the build target for you based on the project usage, but you can manually specify the build target to use via the `--build-target` option.

```shell
nx g @nrwl/react:cypress-component-configuration --project=your-project --build-target=my-react-app:build

nx g @nrwl/angular:cypress-component-configuration --project=your-project --build-target=my-ng-app:build
```

The build target option can be changed later via updating the `devServerTarget` option in the `component-test` target.

{% callout type="warning" title="Executor Options" %}
When using component testing make sure to set `skipServe: true` in the component test target options, otherwise `@nrwl/cypress` will attempt to run the build first which can slow down your component tests. `skipServe: true` is automatically set when using the `cypress-component-configuration` generator.
{% /callout %}

## Testing Projects

Run `nx component-test your-lib` to execute the component tests with Cypress.

By default, Cypress will run in headless mode. You will have the result of all the tests and errors (if any) in your
terminal. Screenshots and videos will be accessible in `dist/cypress/libs/your-lib/screenshots` and `dist/cypress/libs/your-lib/videos`.

## Watching for Changes (Headed Mode)

With, `nx component-test your-lib --watch` Cypress will start in headed mode. Where you can see your component being tested.

Running Cypress with `--watch` is a great way to iterate on your components since cypress will rerun your tests as you make those changes validating the new behavior.

## More Information

You can read more on component testing in the [Cypress documentation](https://docs.cypress.io/guides/component-testing/writing-your-first-component-test).
