This generator will set up Storybook for your **Nuxt** project. You can also use this generator to generate Storybook configuration for your **Next.js** project. By default, starting Nx 16, Storybook v7 is used.

```bash
nx g @nx/nuxt:storybook-configuration project-name
```

You can read more about how this generator works, in the [Storybook for Nuxt overview page](/recipes/storybook/overview-nuxt#generate-storybook-configuration-for-a-nuxt-project).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/nuxt/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. Also, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/nuxt/writing-tests/test-runner). You can read more about this in the [Nx Storybook interaction tests documentation page](/packages/storybook/documents/interaction-tests)..
- Whether you want to `generateStories` for the components in your project. If you choose `yes`, a `.stories.ts` file will be generated next to each of your components in your project.

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/nuxt/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

## Examples

### Generate Storybook configuration

```bash
nx g @nx/nuxt:storybook-configuration ui
```

This will generate Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory, eg. `.storybook/main.ts`).

### Ignore certain paths when generating stories

```bash
nx g @nx/nuxt:storybook-configuration ui --generateStories=true --ignorePaths="libs/ui/src/not-stories/**,**/**/src/**/*.other.*,apps/my-app/**/*.something.ts"
```

This will generate a Storybook configuration for the `ui` project and generate stories for all components in the `libs/ui/src/lib` directory, except for the ones in the `libs/ui/src/not-stories` directory, and the ones in the `apps/my-app` directory that end with `.something.ts`, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

### Generate stories using JavaScript instead of TypeScript

```bash
nx g @nx/nuxt:storybook-configuration ui --generateStories=true --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.

### Generate Storybook configuration using JavaScript

```bash
nx g @nx/nuxt:storybook-configuration ui --tsConfiguration=false
```

By default, our generator generates TypeScript Storybook configuration files. You can choose to use JavaScript for the Storybook configuration files of your project (the files inside the `.storybook` directory, eg. `.storybook/main.js`).
