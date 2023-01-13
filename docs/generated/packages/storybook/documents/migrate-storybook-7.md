# Migrate to Storybook to version 7

{% callout type="warning" title="Storybook 7 is in beta" %}
[Storybook version 7 is still in beta](https://storybook.js.org/blog/7-0-beta/). Things are evolving dynamically, so it would be better to _avoid using in production_. If you want to use the stable, [6.5 version](https://storybook.js.org/releases/6.5), please go to the [Storybook plugin overview guide](/packages/storybook) to get started.
{% /callout %}

{% callout type="info" title="Setting up Storybook 7 in a new workspace" %}
For settin up Storybook version 7 in a new Nx workspace, or a workspace that does NOT already have Storybook configured already, please refer to our [Storybook 7 setup guide](/packages/storybook/documents/storybook-7-setup).
{% /callout %}

Storybook 7 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 7 beta announcement blog post](https://storybook.js.org/blog/7-0-beta/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 7 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-65x-to-700) and the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937). Do note that _version 7 is still in beta_, and things are evolving dynamically, so it would be better to _avoid using in production_.

You can now migrate your existing Nx workspace with Storybook configuration to use Storybook version 7. This guide will show you how to do that.

## Use the Storybook CLI to upgrade

You can take advantage of the Storybook CLI to automatically migrate some settings of your Storybook setup. For a full guide to migration using the Storybook CLI, please refer to the [Storybook 7 migration guide](https://chromatic-ui.notion.site/Storybook-7-migration-guide-dbf41fa347304eb2a5e9c69b34503937).

The Storybook migration scripts do not work perfectly with Nx, however we can use them to get the latest beta versions of our packages, remove some unused packages, and get a hint of some settings that we will need to change manually, eventually.

{% callout type="warning" title="Don't use in production" %}
Please take extra care when migrating your existing Storybook setup to version 7. Do not use in production, since it's still in beta.
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

### 2. Click yes to the automigration prompts

The Storybook CLI will prompt you to run some code generators and modifiers.

Click `yes` to the following:

- `mainjsFramework`: It will add the `framework` field in your root `.storybook/main.js|ts` file. We are going to delete it since it's not needed in the root file, but it's handy to have it ready to copy. Also, it shows you an indication of what it looks like.
- `eslintPlugin`: installs the `eslint-plugin-storybook`
- `storybook-binary`: installs Storybook's `storybook` binary
- `newFrameworks`: removed unused dependencies (eg. `@storybook/builder-webpack5`, `@storybook/manager-webpack5`, `@storybook/builder-vite`)

Click `no` to the following:

- `autodocsTrue`: we don't need it and it can potentially cause issues with missing dependencies

### 3. Restore the root `.storybook/main.js|ts` file

You will have noticed that the Storybook automigrator added the `framework` option to your root `.storybook/main.js|ts` file. Let's remove that, along with the `autodocs` option.

So, remove:

```ts
  framework: {
    name: '@storybook/angular',
    options: {}
  }
```

from your root `.storybook/main.js|ts` file.

### 3. Edit all the project-level `.storybook/main.js|ts` files

Find all your project-level `.storybook/main.js|ts` files and edit them to add the `framework` option. While you are at it, remove the `builder` from `core` options.

#### Remove builder

In your project-level `.storybook/main.js|ts` files, remove the `builder` from `core` options.

Your core options most probably look like this:

```ts
core: { ...rootMain.core, builder: '@storybook/builder-vite' },
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

Choose the `@storybook/react-vite` framework. So add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/react-vite',
    options: {}
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

Choose the `@storybook/web-components-vite` framework. So add this in your project-level `.storybook/main.js|ts` file:

```ts
  framework: {
    name: '@storybook/web-components-vite',
    options: {}
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

#### Resulting project-level `.storybook/main.js|ts` file

Here is an example of a project-level `.storybook/main.js|ts` file:

```ts
const rootMain = require('../../../.storybook/main');

module.exports = {
  ...rootMain,
  stories: [
    ...rootMain.stories,
    '../src/app/**/*.stories.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [...rootMain.addons],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};
```

### 4. For Vite.js projects

Make sure to add the `viteFinal` option to your project-level `.storybook/main.js|ts` files.

```ts
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      plugins: [
        viteTsConfigPaths({
          root: '<PATH_TO_PROJECT_ROOT>',
        }),
      ],
    });
  },
```

This will take care of any path resolution issues.

An example of a project-level `.storybook/main.js|ts` file for a Vite.js project:

```ts
const { mergeConfig } = require('vite');
const viteTsConfigPaths = require('vite-tsconfig-paths').default;
const rootMain = require('../../../.storybook/main');

module.exports = {
  ...rootMain,
  stories: [
    ...rootMain.stories,
    '../src/app/**/*.stories.mdx',
    '../src/app/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [...rootMain.addons],
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      plugins: [
        viteTsConfigPaths({
          root: '../../../',
        }),
      ],
    });
  },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};
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

Since this is a beta version, there are bound to be some issues and bugs. Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).
