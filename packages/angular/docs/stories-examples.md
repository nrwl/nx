This generator will generate stories for all your components in your project. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```bash
nx g @nx/angular:stories project-name
```

You can read more about how this generator works, in the [Storybook for Angular overview page](/recipes/storybook/overview-angular#auto-generate-stories).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests).

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

## Examples

### Ignore certain paths when generating stories

```bash
nx g @nx/angular:stories ui --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*
```

This will generate stories for all the components in the `ui` project, except for the ones in the `libs/ui/src/not-stories` directory, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.
