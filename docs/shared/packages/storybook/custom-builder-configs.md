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

```ts {% fileName=".storybook/main.js" %}
webpackFinal: async (config, { configType }) => {
  // Make whatever fine-grained changes you need that should apply to all storybook configs

  // Return the altered config
  return config;
},
```

### `vite` and `viteFinal`

The `viteFinal` field would look like this:

```ts {% fileName=".storybook/main.js" %}
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

```ts {% fileName=".storybook/main.js" %}
const { mergeConfig } = require('vite');
```

## Project-specific configuration

### `webpack` and `webpackFinal`

You can customize the `webpack` configuration for a specific project by adding a `webpackFinal` field in your project-specific `.storybok/main.js|ts` file, like this:

```ts {% fileName="apps/my-react-webpack-app/.storybook/main.js" %}
module.exports = {
  ...
  webpackFinal: async (config, { configType }) => {

    // add your own webpack tweaks if needed

    return config;
  },
};
```

If you are using a global, root-level, `webpack` configuration in your project, you can customize or extend that for a specific project like this:

```ts {% fileName="apps/my-react-webpack-app/.storybook/main.js" %}
const rootMain = require('../../../.storybook/main');

module.exports = {
  ...rootMain,
  ...
  webpackFinal: async (config, { configType }) => {
    // apply any global webpack configs that might have been specified in .storybook/main.js
    if (rootMain.webpackFinal) {
      config = await rootMain.webpackFinal(config, { configType });
    }

    // add your own webpack tweaks if needed

    return config;
  },
};
```

Take note how, in this case, we are first applying the global `webpack` configuration, and then adding our own tweaks. If you don't want to apply any global configuration, you can just return your own configuration, and skip the `rootMain.webpackFinal` check.

### `vite` and `viteFinal`

You can customize the `vite` configuration for a specific project by adding a `viteFinal` field in your project-specific `.storybok/main.js|ts` file, like this:

```ts {% fileName="apps/my-react-vite-app/.storybook/main.js" %}
const { mergeConfig } = require('vite');
const viteTsConfigPaths = require('vite-tsconfig-paths').default;

module.exports = {
  ...
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      ... <your config here>
    });
  },
};
```

If you are using a global, root-level, `vite` configuration in your workspace, you can customize or extend that for a specific project like this:

```ts {% fileName="apps/my-react-vite-app/.storybook/main.js" %}
const { mergeConfig } = require('vite');
const rootMain = require('../../../.storybook/main');

module.exports = {
  ...
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {
      ...((await rootMain.viteFinal(config, { configType })) ?? {})
    });
  },
};
```

So, a full project-level `.storybook/main.js|ts` file for a Vite.js project would look like this:

```ts {% fileName="apps/my-react-vite-app/.storybook/main.js" %}
const { mergeConfig } = require('vite');

module.exports = {
  stories: ['../src/app/**/*.stories.@(mdx|js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config, { configType }) {
    return mergeConfig(config, {});
  },
};
```
