This generator will set up Storybook for your **React** project. You can also use this generator to generate Storybook configuration for your **Next.js** project. By default, starting Nx 16, Storybook v7 is used.

```bash
nx g @nx/react:storybook-configuration project-name
```

You can read more about how this generator works, in the [Storybook for React overview page](/packages/storybook/documents/overview-react#generate-storybook-configuration-for-an-react-project).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to `configureCypress`. If you choose `yes`, a Cypress e2e app will be created (or configured) to run against the project's Storybook instance. You can read more about this in the [Storybook for React - Cypress section](/packages/storybook/documents/overview-react#cypress-tests-for-stories).
- Whether you want to `generateStories` for the components in your project. If you choose `yes`, a `.stories.ts` file will be generated next to each of your components in your project.
- Whether you want to `generateCypressSpecs`. If you choose `yes`, a test file is going to be generated in the project's Cypress e2e app for each of your components.
- Whether you want to `configureTestRunner`. If you choose `yes`, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/react/writing-tests/test-runner).

You must provide a `name` for the generator to work.

There are a number of other options available. Let's take a look at some examples.

## Examples

### Generate Storybook configuration

```bash
nx g @nx/react:storybook-configuration ui
```

This will generate Storybook configuration for the `ui` project.

### Generate Storybook configuration using TypeScript

```bash
nx g @nx/react:storybook-configuration ui --tsConfiguration=true
```

This will generate Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory, eg. `.storybook/main.ts`).

### Ignore certain paths when generating stories

```bash
nx g @nx/react:storybook-configuration ui --generateStories=true --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*,apps/my-app/**/*.something.ts
```

This will generate a Storybook configuration for the `ui` project and generate stories for all components in the `libs/ui/src/lib` directory, except for the ones in the `libs/ui/src/not-stories` directory, and the ones in the `apps/my-app` directory that end with `.something.ts`, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

### Generate stories using JavaScript instead of TypeScript

```bash
nx g @nx/react:storybook-configuration ui --generateStories=true --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.
