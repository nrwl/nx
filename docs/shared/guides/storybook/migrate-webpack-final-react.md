# Nrwl React Storybook Preset

Nx 12.7 comes with a dedicated Storybook preset for React which drammatically simplifies the Storybook setup and makes sure that Storybook uses the same webpack configuration as your React applications running within an Nx workspace.

{% youtube
src="https://www.youtube.com/embed/oUE74McS_NY"
title="New in Nx 12.7: React Storybook Preset"
width="100%" /%}

Here are the main differences to the previous versions of Nx:

- there's no `webpack.config.js`; Custom webpack configurations can be added in the `webpackFinal` property of the `main.js` file
- the `main.js` file now contains a predefined Storybook preset exported by `@nrwl/react/plugins/storybook`.

Here's an example of a newly generated `main.js` file:

```javascript
// project-level .storybook/main.js file
const rootMain = require('../../../.storybook/main');

module.exports = {
  ...rootMain,

  core: {
    ...rootMain.core,
    // opt-into Storybook Webpack 5
    builder: 'webpack5'
  }

  stories: [
    ...rootMain.stories,
    '../src/lib/**/*.stories.mdx',
    '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: [...rootMain.addons, '@nrwl/react/plugins/storybook'],
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

At the Nx workspace root level, the configuration file looks as follows:

```javascript
// root level .storybook/main.js file
module.exports = {
  stories: [],
  addons: ['@storybook/addon-essentials'],
  // uncomment the property below if you want to apply some webpack config globally
  // webpackFinal: async (config, { configType }) => {
  //   // Make whatever fine-grained changes you need that should apply to all storybook configs

  //   // Return the altered config
  //   return config;
  // },
};
```

## Migrating

If you're upgrading from a lower version of Nx, your old Storybook configuration will still work. New configurations generated will use the new syntax as shown above. The newly generated code will also make sure to extend from a global `webpack.config.js` which might exist in the root-level `.storybook/` directory of your Nx workspace.

This gives you the flexibility to incrementally migrate your configurations.

Here's the step-by-step migration process:

### 1. adjust the `main.js` file

Restructure your `main.js` file so that it looks like in the example illustrated above.

If you need to keep your root-level `.storybook/webpack.config.js` for now, then make sure you adjust the `main.js` in a way that it properly calls the root-level `webpack.config.js` to inherit all of the global configurations.

```javascript
const rootMain = require('../../../.storybook/main');
const rootWebpackConfig = require('../../../.storybook/webpack.config');

module.exports = {
  ...rootMain,
  ...
  webpackFinal: async (config) => {
    // for backwards compatibility call the `rootWebpackConfig`
    // this can be removed once that one is migrated fully to
    // use the `webpackFinal` property in the `main.js` file
    config = rootWebpackConfig({ config });

    // add your own webpack tweaks if needed

    return config;
  },
};
```

**Note:** The easiest way is probably to generate a new library and Storybook configuration and then copy & paste the `main.js`.

### 2. Move any custom webpack configuration to `webpackFinal`

In previous versions of Nx a custom `webpack.config.js` was generated with the following content:

```javascript
module.exports = async ({ config, mode }) => {
  config = await rootWebpackConfig({ config, mode });

  const tsPaths = new TsconfigPathsPlugin({
    configFile: './tsconfig.base.json',
  });

  config.resolve.plugins
    ? config.resolve.plugins.push(tsPaths)
    : (config.resolve.plugins = [tsPaths]);

  // Found this here: https://github.com/nrwl/nx/issues/2859
  // And copied the part of the solution that made it work

  const svgRuleIndex = config.module.rules.findIndex((rule) => {
    const { test } = rule;

    return test.toString().startsWith('/\\.(svg|ico');
  });
  config.module.rules[svgRuleIndex].test =
    /\.(ico|jpg|jpeg|png|gif|eot|otf|webp|ttf|woff|woff2|cur|ani|pdf)(\?.*)?$/;

  config.module.rules.push(
    {
      test: /\.(png|jpe?g|gif|webp)$/,
      loader: require.resolve('url-loader'),
      options: {
        limit: 10000, // 10kB
        name: '[name].[hash:7].[ext]',
      },
    },
    {
      test: /\.svg$/,
      oneOf: [
        // If coming from JS/TS file, then transform into React component using SVGR.
        {
          issuer: {
            test: /\.[jt]sx?$/,
          },
          use: [
            {
              loader: require.resolve('@svgr/webpack'),
              options: {
                svgo: false,
                titleProp: true,
                ref: true,
              },
            },
            {
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]',
                esModule: false,
              },
            },
          ],
        },
        // Fallback to plain URL loader.
        {
          use: [
            {
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000, // 10kB
                name: '[name].[hash:7].[ext]',
              },
            },
          ],
        },
      ],
    }
  );

  return config;
};
```

Such webpack file is no more needed as the `@nrwl/react/plugins/storybook` now takes care of it.

In case you made custom modifications to the `webpack.config.js` file, you need to move them over to the `main.js` `webpackFinal` property and then delete the `webpack.config.js`.

### 3. Remove the root-level `.storybook/webpack.config.js` file

Once you've migrated all your libraries, you can think about removing the root-level `.storybook/webpack.config.js` file and migrate any custom configuration there to `.storybook/main.js` `webpackFinal` property in the very same folder.

### 4. Opting in to Webpack 5

If you choose to opt-in to Webpack 5, by specifying `builder: 'webpack5'` in your project's `.storybook/main.(js|ts)` (as shown above, in the example of a newly generated `main.js` file), don't forget to add the Storybook dependencies for Webpack 5 to work:

```shell
yarn add -D @storybook/builder-webpack5 @storybook/manager-webpack5
```

or if you're using `npm`:

```shell
npm install --save-dev @storybook/builder-webpack5 @storybook/manager-webpack5
```
