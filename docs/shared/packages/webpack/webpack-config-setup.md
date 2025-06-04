---
title: Configure Webpack in your Nx workspace
description: A guide on how to configure webpack on your Nx workspace, and instructions on how to customize your webpack configuration
---

# Configure Webpack in your Nx workspace

You can configure Webpack using a [`webpack.config.js`](https://webpack.js.org/concepts/configuration/) file in your project. Nx infers the `build` and `serve` targets from your webpack configuration as long as you have `@nx/webpack/plugin` added to your `nx.json`.

```json5 {% fileName="nx.json" %}
"plugins": [
  {
    "plugin": "@nx/webpack/plugin",
    "options": {
      "buildTargetName": "build",
      "serveTargetName": "serve"
    }
  }
]
```

If you are using the [`@nx/webpack:webpack`](/technologies/build-tools/webpack/api/executors/webpack) executor, the path to your webpack config is set in the `webpackConfig` option in your `project.json` file.

```json5 {% fileName="project.json" highlightLines=["7"] %}
"my-app": {
  "targets": {
    //...
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "webpackConfig": "apps/my-app/webpack.config.js",
        //...
      },
      // ...
    },
  }
}
```

In the webpack config file, you can add the necessary configuration for Webpack. Read more on how to configure Webpack in the [Webpack documentation](https://webpack.js.org/concepts/configuration/).

## Basic and Nx-enhanced configuration files

Nx supports two flavors of Webpack configuration files:

1. [_Basic_](#basic-configuration-for-nx) (or standard) Webpack configuration. The file exports a Webpack config object, or one of the [standard configuration types](https://webpack.js.org/configuration/configuration-types).
2. [_Nx-enhanced_](#nxenhanced-configuration-with-composable-plugins) Webpack configuration. The file exports a function that takes in a Webpack configuration object, plus the [`@nx/webpack:webpack`](/technologies/build-tools/webpack/api/executors/webpack) options and context, and returns an updated Webpack configuration object.

The basic configuration works with Webpack CLI, whereas the Nx-enhanced configuration requires the use of the `@nx/webpack:webpack` executor.

### Basic configuration for Nx

{% callout type="info" title="Module federation support" %}
Currently, Nx module federation requires an enhanced Webpack configuration file an the use of the `withModuleFederation` plugin. See the next section for more details.
{% /callout %}

A basic Webpack configuration was introduced in Nx 18, and it looks like this:

```js {% fileName="apps/demo/webpack.config.js" %}
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/demo'),
  },
  devServer: {
    port: 4200,
  },
  plugins: [
    new NxAppWebpackPlugin({
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      index: './src/index.html',
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
  ],
};
```

The [`NxAppWebpackPlugin`](/technologies/build-tools/webpack/recipes/webpack-plugins#nxappwebpackplugin) plugin takes a `main` entry file and produces a bundle in the output directory as defined in `output.path`. You can also pass the `index` option if it is a webapp, which will handle outputting scripts and stylesheets in the output file. Note that `NxWebpackPlugin` is optional, and you can bring your own Webpack configuration without using it or any plugins from `@nx/webpack`.

For more information, see the [Webpack plugins guide](/technologies/build-tools/webpack/recipes/webpack-plugins).

### Nx-enhanced configuration with composable plugins

{% callout type="info" title="Non-standard webpack config" %}
Nx-enhanced configuration, via `composePlugins` and [`withNx`](/technologies/build-tools/webpack/recipes/webpack-plugins#withnx) functions, requires the usage of `@nx/webpack:webpack` executor in your `project.json` file. This flavor of configuration do not work with the Webpack CLI.
{% /callout %}

Nx supports a function to be returned from the Webpack configuration file. This function is a composable plugin that is understood by the `@nx/webpack:webpack` executor. The enhanced configuration looks something like this:

```js {% fileName="apps/demo/webpack.config.js" %}
const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(
  // Default Nx composable plugin
  withNx(),
  // Custom composable plugin
  (config, { options, context }) => {
    // `config` is the Webpack configuration object
    // `options` is the options passed to the `@nx/webpack:webpack` executor
    // `context` is the context passed to the `@nx/webpack:webpack` executor
    // customize configuration here
    return config;
  }
);
```

There are two advantages of this approach:

1. You can chain multiple plugins together using the `composePlugins` function. Each plugin can update the webpack configuration as needed.
2. You gain access to the target options and executor context within the webpack configuration file.

This gives you the ability to customize the Webpack configuration as needed, and make use of the options and context passed to the executor, as well.

#### Additional composable plugins for Nx

In addition to the `withNx` composable plugin, Nx provides other composable plugins such as `withWeb`, `withReact`, and `withModuleFederation`. You can read more about how these plugins work and how to use them in our [Webpack plugins guide](/technologies/build-tools/webpack/recipes/webpack-plugins).

## Customize your Webpack configuration

For most apps, the default configuration of Webpack is sufficient, but sometimes you need to tweak a setting in your Webpack config. This guide explains how to make a small change without taking on the maintenance burden of the entire webpack config.

### Configure Webpack for React projects

React projects use the `@nx/react` package to build their apps. This package provides `NxReactWebpackPlugin` and a `withReact` composable plugin that adds the necessary configuration for React to work with Webpack. The `NxReactWebpackPlugin` is used in a basic Webpack configuration file, whereas `withReact` is requires a Nx-enhanced Webpack configuration file.

{% tabs %}
{% tab label="Basic Webpack configuration" %}

```js {% fileName="apps/demo/app/webpack.config.js" %}
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/demo'),
  },
  devServer: {
    port: 4200,
  },
  plugins: [
    new NxAppWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'swc',
      main: './src/main.tsx',
      index: '.src/index.html',
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
    new NxReactWebpackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
  ],
};
```

{% /tab %}
{% tab label="Nx-enhanced Webpack configuration" %}

```js {% fileName="apps/demo/app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

// Nx composable plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  (config, { options, context }) => {
    // Update the webpack configuration as needed here.
    // e.g. config.plugins.push(new MyPlugin())
    return config;
  }
);
```

{% /tab %}

{% /tabs %}

### Configure Webpack for Module Federation

{% callout type="info" title="Non-standard webpack config" %}
`composePlugins`, `withNx`, and `withModuleFederation` do not work with the Webpack CLI and requires the use of the `@nx/webpack:webpack` executor.
{% /callout %}

If you use the [Module Federation](/technologies/module-federation/concepts/faster-builds-with-module-federation) support
from `@nx/angular` or `@nx/react` then
you can customize your Webpack configuration as follows.

```js {% fileName="apps/my-app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nx/webpack');
const { merge } = require('webpack-merge');
const withModuleFederation = require('@nx/react/module-federation');
// or `const withModuleFederation = require('@nx/angular/module-federation');`

module.exports = composePlugins(
  withNx(),
  async (config, { options, context }) => {
    const federatedModules = await withModuleFederation({
      // your options here
    });

    return merge(federatedModules(config, { options, context }), {
      // overwrite values here
    });
  }
);
```

Reference the [Webpack documentation](https://webpack.js.org/configuration/) for details on the structure of the Webpack
configuration object.

### Configure Webpack for Next.js Applications

Next.js supports Webpack customization in the `next.config.js` file.

```js {% fileName="next.config.js" %}
const { withNx } = require('@nx/next/plugins/with-nx');

const nextConfig = {
  webpack: (
    config,
    { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }
  ) => {
    // Important: return the modified config
    return config;
  },
};

return withNx(nextConfig);
```

Read the [official documentation](https://nextjs.org/docs/api-reference/next.config.js/custom-webpack-config) for more details.
