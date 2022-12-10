This is a framework-agnostic generator for setting up Storybook configuration for a project.

```bash
nx g @nrwl/storybook:configuration
```

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- The `uiFramework` you want to use. Supported values are: `"@storybook/angular"`, `"@storybook/react"`, `"@storybook/react-native"`, `"@storybook/html"`, `"@storybook/web-components"`, `"@storybook/vue"`, `"@storybook/vue3"` and `"@storybook/svelte"`.
- Whether you want to `configureCypress`. If you choose `yes`, a Cypress e2e app will be created (or configured) to run against the project's Storybook instance.
- Whether you want to `configureTestRunner`. If you choose `yes`, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/react/writing-tests/test-runner).

You must provide a `name` and a `uiFramework` for the generator to work.

You can read more about how this generator works, in the [Storybook package overview page](https://nx.dev/packages/storybook#generating-storybook-configuration).

If you are using Angular, React, React Native or Next.js in your project, it's best to use the framework specific generator:

- [React Storybook Configuration Generator](/packages/react/generators/storybook-configuration) (React and Next.js projects)

- [Angular Storybook Configuration Generator](/packages/angular/generators/storybook-configuration)

- [React Native Storybook Configuration Generator](/packages/react-native/generators/storybook-configuration)

## Examples

### Generate Storybook configuration using TypeScript

```bash
nx g @nrwl/storybook:configuration ui --uiFramework=@storybook/web-components --tsConfiguration=true
```

This will generate a Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory).
