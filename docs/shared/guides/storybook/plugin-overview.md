![Storybook logo](/shared/storybook-logo.png)

[Storybook](https://storybook.js.org) is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

This guide will briefly walk you through using Storybook within an Nx workspace.

## Setting Up Storybook

### Add the Storybook plugin

```bash
yarn add --dev @nrwl/storybook
```

## Using Storybook

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```bash
nx g @nrwl/storybook:configuration project-name
```

You can choose to use Storybook for one of the supported frameworks:

- `@storybook/angular`
- `@storybook/react`
- `@storybook/react-native`
- `@storybook/html`
- `@storybook/web-components`
- `@storybook/vue`
- `@storybook/vue3`
- `@storybook/svelte`

Choosing one of these frameworks will have the following effects on your workspace:

1. Nx will install all the required Storybook packages that go with it.

2. Nx will generate a root `.storybook` folder and a project-level `.storybook` folder (located under `libs/your-project/.storybook` or `apps/your-project/.storybook`) containing the essential configuration files for Storybook.

3. If you are working on an Angular, a React or a React Native project (and you choose `@storybook/angular`, `@storybook/react` or `@storybook/react-native`) the Nx generator will also generate stories for all the components in your project.

4. Nx will create new `targets` in your project's `project.json`, called `storybook` and `build-storybook`, containing all the necessary configuration to serve and build Storybook.

5. Nx will generate a new Cypress e2e app for your project (if there isn't one already) to run against the Storybook instance.

### Configure your project using TypeScript

You can choose to configure your project using TypeScript instead of JavaScript. To do that, just add the `--tsConfiguration=true` flag to the above command, like this:

```bash
nx g @nrwl/storybook:configuration project-name --tsConfiguration=true
```

[Here is the Storybook documentation](https://storybook.js.org/docs/react/configure/overview#configure-your-project-with-typescript) if you want to learn more.

### Running Storybook

Serve Storybook using this command:

```bash
nx run project-name:storybook
```

or

```bash
nx storybook project-name
```

### Building Storybook

Build Storybook using this command:

```bash
nx run project-name:build-storybook
```

or

```bash
nx build-storybook project-name
```

## More Documentation

You can find dedicated information for React and Angular:

- [Overview Storybook For Angular](/storybook/overview-angular)
- [Overview Storybook For React](/storybook/overview-react)

You can find all Storybook-related Nx topics [here](/packages#storybook).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Upgrading to Storybook 6](/storybook/upgrade-storybook-v6-react)
- [Migrate to the Nrwl React Storybook Preset](/storybook/migrate-webpack-final-react)
