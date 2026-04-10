---
title: How to configure Webpack and Vite for Storybook
description: This guide explains how to customize the webpack configuration and your vite configuration for Storybook.
---

# How to configure Webpack and Vite for Storybook

Storybook allows you to customize the `webpack` configuration and your `vite` configuration. For that, it offers two fields you can add in your `.storybook/main.js|ts` file, called `webpackFinal` and `viteFinal`. These fields are functions that take the default configuration as an argument, and return the modified configuration. You can read more about them in the [Storybook documentation for `webpack`](https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config) and the [Storybook documentation for `vite`](https://storybook.js.org/docs/react/builders/vite#configuration).

You can use these fields in your Nx workspace Storybook configurations normally, following the Storybook docs. However, let's see how you can create a global configuration for every project in your workspace, and how you can override it for specific projects.

## Global configuration

If you want to add a global configuration for Webpack or Vite in your workspace, you may create a `.storybook/main.js` file at the root of your workspace. In that root `.storybook/main.js|ts` file, you can add the `webpackFinal` or `viteFinal` field, and return the modified configuration. This will be applied to every project in your workspace.

### `webpack` and `webpackFinal`

The `webpackFinal` field would look like this:

```ts {% fileName=".storybook/main.ts" %}
webpackFinal: async (config, { configType }) => {
  // Make whatever fine-grained changes you need that should apply to all storybook configs

  // Return the altered config
  return config;
},
```

### `vite` and `viteFinal`

The `viteFinal` field would look like this:

```ts {% fileName=".storybook/main.ts" %}
async viteFinal(config, { configType }) {
   if (configType === 'DEVELOPMENT') {
     // Your development configuration goes here
   }
   if (configType === 'PRODUCTION') {
     // Your production configuration goes here.
   }
   return mergeConfig(config, {
     // Your environment configuration here
   });
 },
```

In the `viteFinal` case, you would have to import the `mergeConfig` function from `vite`. So, on the top of your root `.storybook/main.js|ts` file, you would have to add:

```ts {% fileName=".storybook/main.ts" %}
import { mergeConfig } from 'vite';
```

## Project-specific configuration

### `webpack` and `webpackFinal`

You can customize the `webpack` configuration for a specific project by adding a `webpackFinal` field in your project-specific `.storybok/main.js|ts` file, like this:

```ts {% fileName="apps/my-react-webpack-app/.storybook/main.ts" %}
import type { StorybookConfig } from '@storybook/react-webpack5';

const config: StorybookConfig = {
  stories: ...,
  addons: ...,
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  webpackFinal: async (config, { configType }) => {
    // add your own webpack tweaks if needed
    return config;
  },
};

export default config;
```

If you are using a global, root-level, `webpack` configuration in your project, you can customize or extend that for a specific project like this:

```ts {% fileName="apps/my-react-webpack-app/.storybook/main.ts" %}
import rootMain from '../../../.storybook/main';

const config: StorybookConfig = {
  ...rootMain,
  stories: ...,
  addons: ...,
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  webpackFinal: async (config, { configType }) => {
    // apply any global webpack configs that might have been specified in .storybook/main.js
    if (rootMain.webpackFinal) {
      config = await rootMain.webpackFinal(config, { configType });
    }
    // add your own webpack tweaks if needed
    return config;
  },
};

export default config;
```

Take note how, in this case, we are first applying the global `webpack` configuration, and then adding our own tweaks. If you don't want to apply any global configuration, you can just return your own configuration, and skip the `rootMain.webpackFinal` check.

### `vite` and `viteFinal`

You can customize the `vite` configuration for a specific project by adding a `viteFinal` field in your project-specific `.storybok/main.js|ts` file, like this:

```ts {% fileName="apps/my-react-vite-app/.storybook/main.ts" %}
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ...,
  addons: ...,
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/web/vite.config.ts',
      },
    },
  },
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      ... <your config here>
    });
  },
};

export default config;
```

If you are using a global, root-level, `vite` configuration in your workspace, you can customize or extend that for a specific project like this:

```ts {% fileName="apps/my-react-vite-app/.storybook/main.ts" %}
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import rootMain from '../../../.storybook/main';

const config: StorybookConfig = {
  ...rootMain,
  stories: ...,
  addons: ...,
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: 'apps/web/vite.config.ts',
      },
    },
  },
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      ...((await rootMain.viteFinal(config, { configType })) ?? {})
    });
  },
};

export default config;
```
