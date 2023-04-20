---
title: How to configure webpack on your Nx workspace
description: A guide on how to configure webpack on your Nx workspace, and instructions on how to customize your webpack configuration
---

# Configure webpack on your Nx workspace

You can configure Webpack using a `webpack.config.js` file in your project. You can set the path to this file in your `project.json` file, in the `build` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/webpack:webpack",
            //...
            "options": {
                //...
                "webpackConfig": "apps/my-app/webpack.config.js"
            },
            "configurations": {
                ...
            }
        },
    }
}
```

In that file, you can add the necessary configuration for Webpack. You can read more on how to configure webpack in the [Webpack documentation](https://webpack.js.org/concepts/configuration/).

## Using webpack with `isolatedConfig`

Setting `isolatedConfig` to `true` in your `project.json` file means that Nx will not apply the Nx webpack plugins automatically. In that case, the Nx plugins need to be applied in the project's `webpack.config.js` file (e.g. `withNx`, `withReact`, etc.). So don't forget to also specify the path to your webpack config file (using the `webpackConfig` option).

Note that this is the new default setup for webpack in the latest version of Nx.

Set `isolatedConfig` to `true` in your `project.json` file in the `build` target options like this:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/webpack:webpack",
            //...
            "options": {
                //...
                "webpackConfig": "apps/my-app/webpack.config.js",
                "isolatedConfig": true
            },
            "configurations": {
                ...
            }
        },
    }
}
```

Now, you need to manually add the Nx webpack plugins in your `webpack.config.js` file for Nx to work properly. Let's see how to do that.

### Basic configuration for Nx

You should start with a basic webpack configuration for Nx in your project, that looks like this:

```js {% fileName="apps/my-app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  // customize webpack config here
  return config;
});
```

The `withNx()` plugin adds the necessary configuration for Nx to work with Webpack. The `composePlugins` function allows you to add other plugins to the configuration.

#### The `composePlugins` function

The `composePlugins` function takes a list of plugins and a function, and returns a webpack `Configuration` object. The `composePlugins` function is an enhanced version of the [webpack configuration function](https://webpack.js.org/configuration/configuration-types/#exporting-a-function), which allows you to add plugins to the configuration, and provides you with a function which accepts two arguments:

1. `config`: The webpack configuration object.
2. An object with the following properties:
   - `options`: The options passed to the `@nx/webpack:webpack` executor.
   - `context`: The context passed of the `@nx/webpack:webpack` executor.

This gives you the ability to customize the webpack configuration as needed, and make use of the options and context passed to the executor, as well.

### Add configurations for other functionalities

In addition to the basic configuration, you can add configurations for other frameworks or features. The `@nx/webpack` package provides plugins such as `withWeb` and `withReact`. This plugins provide features such as TS support, CSS support, JSX support, etc. You can read more about how these plugins work and how to use them in our [Webpack Plugins guide](/packages/webpack/documents/webpack-plugins).

You may still reconfigure everything manually, without using the Nx plugins. However, these plugins ensure that you have the necessary configuration for Nx to work with your project.

## Customize your Webpack config

For most apps, the default configuration of webpack is sufficient, but sometimes you need to tweak a setting in your webpack config. This guide explains how to make a small change without taking on the maintenance burden of the entire webpack config.

### Configure webpack for React projects

React projects use the `@nx/react` package to build their apps. This package provides a `withReact` plugin that adds the necessary configuration for React to work with webpack. You can use this plugin to add the necessary configuration to your webpack config.

```js {% fileName="apps/my-app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  (config, { options, context }) => {
    // Update the webpack config as needed here.
    // e.g. config.plugins.push(new MyPlugin())
    return config;
  }
);
```

### Add a CSS loader to your webpack config

To add the `css-loader` to your config, install it and add the rule.

{% tabs %}
{% tab label="yarn" %}

```shell
yarn add -D css-loader
```

{% /tab %}
{% tab label="npm" %}

```shell
npm install -D css-loader
```

{% /tab %}
{% /tabs %}

```js {% fileName="apps/my-app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nx/webpack');
const { merge } = require('webpack-merge');

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  return merge(config, {
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
  });
});
```

### Configure webpack for Module Federation

If you use the [Module Federation](/recipes/module-federation/faster-builds) support from `@nx/angular` or `@nx/react` then
you can customize your webpack configuration as follows.

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

Reference the [webpack documentation](https://webpack.js.org/configuration/) for details on the structure of the webpack
config object.

### Configure webpack for Next.js Applications

Next.js supports webpack customization in the `next.config.js` file.

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
