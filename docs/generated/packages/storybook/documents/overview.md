---
title: Nx Storybook Plugin Overview
description: This is an overview page for the Storybook plugin in Nx. It explains what Storybook is and how to set it up in your Nx workspace.
---

[Storybook](https://storybook.js.org) is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

This guide will briefly walk you through using Storybook within an Nx workspace.

{% callout type="info" title="Storybook 7 by default" %}
Starting with Nx 16, Storybook 7 is used by default to configure your projects.
{% /callout %}

## Setting Up Storybook

### Add the Storybook plugin

{% tabs %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/storybook
```

{% /tab %}
{% tab label="npm" %}

```shell
npm install -D @nx/storybook
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install -D @nx/storybook
```

{% /tab %}
{% /tabs %}

## Using Storybook

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```shell
nx g @nx/storybook:configuration project-name
```

If you are NOT using a framework-specific generator (for [Angular](/packages/angular/generators/storybook-configuration), [React](/packages/react/generators/storybook-configuration), [React Native](/packages/react-native/generators/storybook-configuration)), in the field `uiFramework` you must choose one of the following Storybook frameworks:

- `@storybook/angular`
- `@storybook/html-webpack5`
- `@storybook/nextjs`
- `@storybook/preact-webpack5`
- `@storybook/react-webpack5`
- `@storybook/react-vite`
- `@storybook/server-webpack5`
- `@storybook/svelte-webpack5`
- `@storybook/svelte-vite`
- `@storybook/sveltekit`
- `@storybook/vue-webpack5`
- `@storybook/vue-vite`
- `@storybook/vue3-webpack5`
- `@storybook/vue3-vite`
- `@storybook/web-components-webpack5`
- `@storybook/web-components-vite`

Choosing one of these frameworks will have the following effects on your workspace:

1. Nx will install all the required Storybook packages that go with it.

2. Nx will generate a project-level `.storybook` folder (located under `libs/your-project/.storybook` or `apps/your-project/.storybook`) containing the essential configuration files for Storybook.

3. Nx will create new `targets` in your project's `project.json`, called `storybook` and `build-storybook`, containing all the necessary configuration to serve and build Storybook.

4. Nx will generate a new Cypress e2e app for your project (if there isn't one already) to run against the Storybook instance.

Make sure to **use the framework-specific generators** if your project is using Angular, React, Next.js or React Native: [`@nx/angular:storybook-configuration`](/packages/angular/generators/storybook-configuration), [`@nx/react:storybook-configuration`](/packages/react/generators/storybook-configuration), [`@nx/react-native:storybook-configuration`](/packages/react-native/generators/storybook-configuration):

{% tabs %}
{% tab label="Angular" %}

```shell
nx g @nx/angular:storybook-configuration my-angular-project
```

{% /tab %}
{% tab label="React" %}

```shell
nx g @nx/react:storybook-configuration my-react-project
```

{% /tab %}
{% tab label="React Native" %}

```shell
nx g @nx/react-native:storybook-configuration my-react-native-project
```

{% /tab %}
{% /tabs %}

These framework-specific generators will also **generate stories** for you.

### Configure your project using TypeScript

You can choose to configure your project using TypeScript instead of JavaScript. To do that, just add the `--tsConfiguration=true` flag to the above command, like this:

```shell
nx g @nx/storybook:configuration project-name --tsConfiguration=true
```

[Here is the Storybook documentation](https://storybook.js.org/docs/react/configure/overview#configure-your-project-with-typescript) if you want to learn more about configuring your project with TypeScript.

### Running Storybook

Serve Storybook using this command:

```shell
nx run project-name:storybook
```

or

```shell
nx storybook project-name
```

### Building Storybook

Build Storybook using this command:

```shell
nx run project-name:build-storybook
```

or

```shell
nx build-storybook project-name
```

### Anatomy of the Storybook setup

When running the Nx Storybook generator, it'll configure the Nx workspace to be able to run Storybook seamlessly. It'll create a project specific Storybook configuration.

The project-specific Storybook configuration is pretty much similar to what you would have for a non-Nx setup of Storybook. There's a `.storybook` folder within the project root folder.

```text
<project root>/
├── .storybook/
│   ├── main.js
│   ├── preview.js
│   ├── tsconfig.json
├── src/
├── README.md
├── tsconfig.json
└── etc...
```

### Using Addons

To register a [Storybook addon](https://storybook.js.org/addons/) for all Storybook instances in your workspace:

1. In your project's `.storybook/main.js` file, in the `addons` array of the `module.exports` object, add the new addon:

   ```typescript {% fileName="<project-path>/.storybook/main.js" %}
   module.exports = {
   stories: [...],
   ...,
   addons: [..., '@storybook/addon-essentials'],
   };
   ```

2. If a decorator is required, in each project's `<project-path>/.storybook/preview.js`, you can export an array called `decorators`.

   ```typescript {% fileName="<project-path>/.storybook/preview.js" %}
   import someDecorator from 'some-storybook-addon';
   export const decorators = [someDecorator];
   ```

### Setting up documentation

To set up documentation, you can use [Storybook Autodocs](https://storybook.js.org/docs/react/writing-docs/autodocs). For Angular, [you can use `compodoc`](/packages/storybook/documents/angular-storybook-compodoc) to infer `argTypes`. You can read more about `argTypes` in the [official Storybook `argTypes` documentation](https://storybook.js.org/docs/angular/api/argtypes#automatic-argtype-inference).

You can read more about how to best set up documentation using Storybook for your project in the [official Storybook documentation](https://storybook.js.org/docs/react/writing-docs/introduction).

## More Documentation

You can find dedicated information for React and Angular:

- [Set up Storybook for Angular Projects](/packages/storybook/documents/overview-angular)
- [Set up Storybook for React Projects](/packages/storybook/documents/overview-react)

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Upgrading to Storybook 6](/deprecated/storybook/upgrade-storybook-v6-react)
- [Migrate to the Nx React Storybook Addon](/deprecated/storybook/migrate-webpack-final-react)
- [Storybook 7 migration generator](/packages/storybook/generators/migrate-7)
- [Storybook 7 setup guide](/packages/storybook/documents/storybook-7-setup)

You can find all Storybook-related Nx documentation [here](/packages#storybook).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

## Older documentation

You can find older documentation for the `@nx/storybook` package in our [deprecated section](/deprecated/storybook).
