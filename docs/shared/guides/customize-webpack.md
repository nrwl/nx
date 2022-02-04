# Customizing Webpack Config

For most apps, the default configuration of webpack is sufficient, but sometimes you need to tweak a setting in your webpack config. This guide explains how to make a small change without taking on the maintenance burden of the entire webpack config.

Note: For Angular developers, use an executor like [`ngx-build-plus`](https://github.com/manfredsteyer/ngx-build-plus).

In your `project.json` configuration for the `@nrwl/web:build` or `@nrwl/node:build` executor, set the [`webpackConfig`](/web/build#webpackconfig) option to point to your custom webpack config file. i.e. `apps/my-app/custom-webpack.config.js`

The custom webpack file contains a function that takes as input the existing webpack config and then returns a modified config object. `context` includes all the options specified for the executor.

`apps/my-app/custom-webpack.config.js`:

```typescript
module.exports = (config, context) => {
  return {
    ...config,
    // overwrite values here
  };
};
```

Reference the [webpack documentation](https://webpack.js.org/configuration/) for details on the structure of the webpack config object.
