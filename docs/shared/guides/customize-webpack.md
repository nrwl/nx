# Customizing Webpack Config

For most apps, the default configuration of webpack is sufficient, but sometimes you need to tweak a setting in your webpack config. This guide explains how to make a small change without taking on the maintenance burden of the entire webpack config.

Note: For Angular developers, use an executor like [`ngx-build-plus`](https://github.com/manfredsteyer/ngx-build-plus).

In your `project.json` configuration for the `@nrwl/web:build` or `@nrwl/node:build` executor, set the [`webpackConfig`](/web/build#webpackconfig) option to point to your custom webpack config file. i.e. `apps/my-app/custom-webpack.config.js`

The custom webpack file contains a function that takes as input the existing webpack config and then returns a modified config object. `context` includes all the options specified for the executor.

`apps/my-app/custom-webpack.config.js`:

```typescript
// Helper for combining webpack config objects
const { merge } = require('webpack-merge');

module.exports = (config, context) => {
  return merge(config, {
    // overwrite values here
  });
};
```

Also supports promises

```typescript
// Utility function for sleeping
const sleep = (n) => new Promise((resolve) => setTimeout(resolve, n));

module.exports = async (config, context) => {
  await sleep(10);
  return merge(config, {
    // overwrite values here
  });
};
```

## Add a Loader

To add the `css-loader` to your config, install it and add the rule.

```bash
npm install -save-dev css-loader
```

```typescript
const { merge } = require('webpack-merge');

module.exports = (config, context) => {
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
};
```

Reference the [webpack documentation](https://webpack.js.org/configuration/) for details on the structure of the webpack config object.
