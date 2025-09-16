---
title: Nx Storybook Plugin Overview
description: This is an overview page for the Storybook plugin in Nx. It explains what Storybook is and how to set it up in your Nx workspace.
---

# @nx/storybook

[Storybook](https://storybook.js.org) is a development environment for UI components. It allows you to browse a component library, view the different states of each component, and interactively develop and test components.

This guide will briefly walk you through using Storybook within an Nx workspace.

## Setting Up Storybook

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/storybook` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/storybook` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/storybook
```

This will install the correct version of `@nx/storybook`.

### How @nx/storybook Infers Tasks

The `@nx/storybook` plugin will create a task for any project that has a Storybook configuration file present. Any of the following files will be recognized as a Storybook configuration file:

- `.storybook/main.js`
- `.storybook/main.ts`
- `.storybook/main.cjs`
- `.storybook/main.cts`
- `.storybook/main.mjs`
- `.storybook/main.mts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/storybook Configuration

The `@nx/storybook/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/storybook/plugin",
      "options": {
        "buildStorybookTargetName": "build-storybook",
        "serveStorybookTargetName": "storybook",
        "testStorybookTargetName": "test-storybook",
        "staticStorybookTargetName": "static-storybook"
      }
    }
  ]
}
```

The `builtStorybookTargetName`, `serveStorybookTargetName`, `testStorybookTargetName` and `staticStorybookTargetName` options control the names of the inferred Storybook tasks. The default names are `build-storybook`, `storybook`, `test-storybook` and `static-storybook`.

## Using Storybook

### Generating Storybook Configuration

You can generate Storybook configuration for an individual project with this command:

```shell
nx g @nx/storybook:configuration project-name
```

or

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
{% tab label="Vue" %}

```shell
nx g @nx/vue:storybook-configuration my-vue-project
```

{% /tab %}
{% /tabs %}

These framework-specific generators will also **generate stories** and interaction tests for you.

If you are NOT using a framework-specific generator (for [Angular](/technologies/angular/api/generators/storybook-configuration), [React](/technologies/react/api/generators/storybook-configuration), [Vue](/technologies/vue/api/generators/storybook-configuration)), in the field `uiFramework` you must choose one of the following Storybook frameworks:

- `@storybook/angular`
- `@storybook/nextjs`
- `@storybook/react-webpack5`
- `@storybook/react-vite`
- `@storybook/server-webpack5`
- `@storybook/svelte-vite`
- `@storybook/sveltekit`
- `@storybook/vue-vite`
- `@storybook/vue3-vite`
- `@storybook/web-components-vite`

Choosing one of these frameworks will have the following effects on your workspace:

1. Nx will install all the required Storybook packages that go with it.

2. Nx will generate a project-level `.storybook` folder (located under `libs/your-project/.storybook` or `apps/your-project/.storybook`) containing the essential configuration files for Storybook.

3. Nx will create new `targets` in your project's `project.json`, called `storybook`, `test-storybook` and `build-storybook`, containing all the necessary configuration to serve, test and build Storybook.

Make sure to **use the framework-specific generators** if your project is using Angular, React, Next.js, Vue, Nuxt, or React Native: [`@nx/angular:storybook-configuration`](/technologies/angular/api/generators/storybook-configuration), [`@nx/react:storybook-configuration`](/technologies/react/api/generators/storybook-configuration), [`@nx/vue:storybook-configuration`](/technologies/vue/api/generators/storybook-configuration) as shown above.

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

### Testing Storybook

With the Storybook server running, you can test Storybook (run all the interaction tests) using this command:

```shell
nx run project-name:test-storybook
```

or

```shell
nx test-storybook project-name
```

### Anatomy of the Storybook setup

When running the Nx Storybook generator, it'll configure the Nx workspace to be able to run Storybook seamlessly. It'll create a project specific Storybook configuration.

The project-specific Storybook configuration is pretty much similar to what you would have for a non-Nx setup of Storybook. There's a `.storybook` folder within the project root folder.

```text
<project root>/
├── .storybook/
│   ├── main.ts
│   └── preview.ts
├── src/
├── README.md
├── tsconfig.json
├── tsconfig.storybook.json
└── etc...
```

### Using Addons

To register a [Storybook addon](https://storybook.js.org/addons/) for all Storybook instances in your workspace:

1. In your project's `.storybook/main.ts` file, in the `addons` array of the `module.exports` object, add the new addon:

```typescript {% fileName="<project-path>/.storybook/main.ts" %}
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  ...
  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions', ...],
  ...
};

export default config;
```

2. If a decorator is required, in each project's `<project-path>/.storybook/preview.ts`, you can export an array called `decorators`.

   ```typescript {% fileName="<project-path>/.storybook/preview.ts" %}
   import someDecorator from 'some-storybook-addon';
   export const decorators = [someDecorator];
   ```

### Setting up documentation

To set up documentation, you can use [Storybook Autodocs](https://storybook.js.org/docs/react/writing-docs/autodocs). For Angular, [you can use `compodoc`](/technologies/test-tools/storybook/recipes/angular-storybook-compodoc) to infer `argTypes`. You can read more about `argTypes` in the [official Storybook `argTypes` documentation](https://storybook.js.org/docs/angular/api/argtypes#automatic-argtype-inference).

You can read more about how to best set up documentation using Storybook for your project in the [official Storybook documentation](https://storybook.js.org/docs/react/writing-docs/introduction).

## More Documentation

You can find dedicated information for React and Angular:

- [Set up Storybook for Angular Projects](/technologies/test-tools/storybook/recipes/overview-angular)
- [Set up Storybook for React Projects](/technologies/test-tools/storybook/recipes/overview-react)
- [Set up Storybook for Vue Projects](/technologies/test-tools/storybook/recipes/overview-vue)

You can find all Storybook-related Nx documentation in the [Storybook recipes section](/technologies/test-tools/storybook/recipes).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/basics/introduction/).

### Migration Scenarios

Here's more information on common migration scenarios for Storybook with Nx. For Storybook specific migrations that are not automatically handled by Nx please refer to the [official Storybook page](https://storybook.js.org/)

- [Storybook 9 migration generator](/technologies/test-tools/storybook/api/generators/migrate-9)
- [Storybook 9 setup guide](/technologies/test-tools/storybook/recipes/storybook-9-setup)
