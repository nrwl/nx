---
title: Migrate your Nx workspace to Storybook version 7
description: This guide explains how migrate your Nx workspace to Storybook version 7.
---

# Migrate your Nx workspace to Storybook version 7

{% callout type="info" title="Available on Nx v15.5" %}
This is a new feature available on Nx v15.5.0. If you are using an older version of Nx, please [upgrade](/packages/nx/documents/migrate).
{% /callout %}

{% callout type="warning" title="Storybook 7 is in beta" %}
[Storybook version 7 is still in beta](https://storybook.js.org/blog/7-0-beta/), and so is the Nx support for it. Things are evolving dynamically, so it would be better to _avoid using in production_ on Nx. If you want to use the stable, [6.5 version](https://storybook.js.org/releases/6.5), please go to the [Storybook plugin overview guide](/packages/storybook) to get started.
{% /callout %}

{% callout type="info" title="Setting up Storybook 7 in a new workspace" %}
For setting up Storybook version 7 in a new Nx workspace, or a workspace that does NOT already have Storybook configured already, please refer to our [Storybook 7 setup guide](/packages/storybook/documents/storybook-7-setup).
{% /callout %}

Storybook 7 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 7 beta announcement blog post](https://storybook.js.org/blog/7-0-beta/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 7 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-65x-to-700) and the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937). Do note that _version 7 is still in beta_, and so is the Nx support for it. Things are evolving dynamically, so it would be better to _avoid using in production_ on Nx.

You can now migrate your existing Nx workspace with Storybook configuration to use Storybook version 7. This guide will show you how to do that.

## Use the Storybook CLI to upgrade

You can take advantage of the Storybook CLI to automatically migrate some settings of your Storybook setup on your Nx workspace. For a full guide to migration using the Storybook CLI, please refer to the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937).

The Storybook migration scripts do not work perfectly on Nx workspaces, however we can use them to get the latest beta versions of our packages, remove some unused packages and get a hint of some settings that we will need to change manually, eventually.

{% callout type="warning" title="Don't use in production" %}
Please take extra care when migrating your existing Storybook setup to version 7 on your Nx workspace. Do not use in production, since it's still in beta, and the Nx support is not stable yet.
{% /callout %}

Let's see the steps we can make to migrate our Storybook setup to version 7.

### 1. Run the `upgrade` command of the Storybook CLI

```bash
npx storybook@next upgrade --prerelease
```

This will:

- Upgrade your dependencies to the latest prerelease version
- Run a number of migration scripts (code generators and modifiers) - upon approval

For more info, see [here](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937).

### 2. Say `yes` to the automigration prompts

The Storybook CLI will prompt you to run some code generators and modifiers.

Say `yes` to the following:

- `mainjsFramework`: It will try to add the `framework` field in your project's `.storybook/main.js|ts` file.
- `eslintPlugin`: installs the `eslint-plugin-storybook`
- `storybook-binary`: installs Storybook's `storybook` binary
- `newFrameworks`: removes unused dependencies (eg. `@storybook/builder-webpack5`, `@storybook/manager-webpack5`, `@storybook/builder-vite`)

Say `no` to the following:

- `autodocsTrue`: we don't need it and it can potentially cause issues with missing dependencies on your Nx workspace

### 3. Edit all the project-level `.storybook/main.js|ts` files

Find all your project-level `.storybook/main.js|ts` files and edit them to add the `framework` option. While you are at it, remove the `builder` from `core` options.

#### Remove builder

In your project-level `.storybook/main.js|ts` files, remove the `builder` from `core` options.

Your core options most probably look like this:

```ts
core: { builder: '@storybook/builder-vite' },
```

You must remove the `builder`, or you can also delete the `core` object entirely.

#### Add framework

Choose the `framework` carefully. The list of available frameworks is:

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

#### For Angular projects

Choose the `@storybook/angular` framework. So add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/angular',
    options: {}
  }
```

#### For React projects using `'@storybook/builder-vite'`

Choose the `@storybook/react-vite` framework. You must also point the builder to the Vite configuration file path, so that it can read the settings from there. If your project's root path is `apps/my-app` and it's using a Vite configuration file at `apps/my-app/vite.config.ts`, then you must add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/react-vite',
    options: {
       builder: {
        viteConfigPath: 'apps/my-app/vite.config.ts',
      },
    }
  }
```

#### For React projects using `'@storybook/builder-webpack5'`

Choose the `@storybook/react-webpack5` framework. So add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/react-webpack5',
    options: {}
  }
```

#### For Next.js projects

Choose the `@storybook/nextjs` framework. So add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/nextjs',
    options: {}
  }
```

#### For Web Components projects using `'@storybook/builder-vite'`

Choose the `@storybook/web-components-vite` framework. You must also point the builder to the Vite configuration file path, so that it can read the settings from there. If your project's root path is `apps/my-app` and it's using a Vite configuration file at `apps/my-app/vite.config.ts`, then you must add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/web-components-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/my-app/vite.config.ts',
      },
    }
  }
```

#### For Web Components projects using `'@storybook/builder-webpack5'`

Choose the `@storybook/web-components-webpack5` framework. So add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/web-components-webpack5',
    options: {}
  }
```

#### For the rest of the projects

You can easily find the correct framework by looking at the `builder` option in your project-level `.storybook/main.js|ts` file.

### 4. Check result of project-level `.storybook/main.js|ts` file

#### Full example for Angular projects

Here is an example of a project-level `.storybook/main.js|ts` file for an Angular project:

```ts {% fileName="apps/my-angular-app/.storybook/main.js" %}
const config = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
```

#### Full example for React projects with Vite

Here is an example of a project-level `.storybook/main.js|ts` file for a React project using Vite:

```ts {% fileName="apps/my-react-app/.storybook/main.js" %}
const config = {
  stories: ['../src/app/**/*.stories.@(js|jsx|ts|tsx|mdx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/rv1/vite.config.ts',
      },
    },
  },
};

export default config;
```

### 5. Remove `uiFramework` from `project.json`

You can now remove the `uiFramework` option from your `storybook` and `build-storybook` targets in your project's `project.json` file.

So, for example, this is what a resulting `storybook` target would look for a non-Angular project:

```json {% fileName="apps/my-react-app/project.json" %}
{
  ...
  "targets": {
    ...
    "storybook": {
      "executor": "@nrwl/storybook:storybook",
      "options": {
        "port": 4400,
        "configDir": "apps/my-react-app/.storybook"
      },
      "configurations": {
        ...
      }
    },
```

## Use Storybook 7 beta

You can now use Storybook 7 beta! 🎉

```bash
npx nx build-storybook PROJECT_NAME
```

and

```bash
npx nx storybook PROJECT_NAME
```

## Report any issues and bugs

Since this is a beta version, and the Nx support is still evolving, there are bound to be some issues and bugs. Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).
