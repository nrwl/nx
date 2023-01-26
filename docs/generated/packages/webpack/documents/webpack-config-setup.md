# Configure webpack on your Nx workspace

You can configure Webpack using a `webpack.config.js` file in your project. You can set the path to this file in your `project.json` file, in the `build` target options:

```json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nrwl/webpack:webpack",
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
            "executor": "@nrwl/webpack:webpack",
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

```ts
// apps/my-app/webpack.config.js
const { composePlugins, withNx } = require('@nrwl/webpack');

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
   - `options`: The options passed to the `@nrwl/webpack:webpack` executor.
   - `context`: The context passed of the `@nrwl/webpack:webpack` executor.

This gives you the ability to customize the webpack configuration as needed, and make use of the options and context passed to the executor, as well.

### Add configurations for other functionalities

In addition to the basic configuration, you can add configurations for other frameworks or features. The `@nrwl/webpack` package provides plugins such as `withWeb` and `withReact`. This plugins provide features such as TS support, CSS support, JSX support, etc. You can read more about how these plugins work and how to use them in our [Webpack Plugins guide](/packages/webpack/documents/webpack-plugins).

You may still reconfigure everything manually, without using the Nx plugins. However, these plugins ensure that you have the necessary configuration for Nx to work with your project.

Here is an example of a configuration that uses the `withReact` plugin:

```ts
// apps/my-react-app/webpack.config.js
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
