# Customize your Webpack Config

{% callout type="note" title="Webpack Config Setup" %}
This guide helps you customize your webpack config - add extra functionality and support for other frameworks or features. To see how you can set up a basic webpack config for Nx, read the [Webpack Config Setup guide](/packages/webpack/documents/webpack-config-setup).
{% /callout %}

For most apps, the default configuration of webpack is sufficient, but sometimes you need to tweak a setting in your webpack config. This guide explains how to make a small change without taking on the maintenance burden of the entire webpack config.

## React projects

React projects use the `@nrwl/react` package to build their apps. This package provides a `withReact` plugin that adds the necessary configuration for React to work with webpack. You can use this plugin to add the necessary configuration to your webpack config.

```js {% fileName="apps/my-app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nrwl/webpack');
const { withReact } = require('@nrwl/react');

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

## Add a Loader

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
const { composePlugins, withNx } = require('@nrwl/webpack');
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

## Module Federation

If you use the [Module Federation](/recipes/module-federation/faster-builds) support from `@nrwl/angular` or `@nrwl/react` then
you can customize your webpack configuration as follows.

```js {% fileName="apps/my-app/webpack.config.js" %}
const { composePlugins, withNx } = require('@nrwl/webpack');
const { merge } = require('webpack-merge');
const withModuleFederation = require('@nrwl/react/module-federation');
// or `const withModuleFederation = require('@nrwl/angular/module-federation');`

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  const federatedModules = await withModuleFederation({
    // your options here
  });

  return merge(federatedModules(config, context), {
    // overwrite values here
  });
});
```

Reference the [webpack documentation](https://webpack.js.org/configuration/) for details on the structure of the webpack
config object.

## Next.js Applications

Next.js supports webpack customization in the `next.config.js` file.

```js {% fileName="next.config.js" %}
const { withNx } = require('@nrwl/next/plugins/with-nx');

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
