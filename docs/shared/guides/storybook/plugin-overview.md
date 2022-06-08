![Storybook logo](/shared/storybook-logo.png)

Storybook is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

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
nx g @nrwl/react:storybook-configuration project-name
```

### Running Storybook

Serve Storybook using this command:

```bash
nx run project-name:storybook
```

## More Documentation

You can find dedicated information for React and Angular:

- [Overview Storybook For Angular](/storybook/overview-angular)
- [Overview Storybook For React](/storybook/overview-react)

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Upgrading to Storybook 6](/storybook/upgrade-storybook-v6-react)
- [Migrate to the Nrwl React Storybook Preset](/storybook/migrate-webpack-final-react)
