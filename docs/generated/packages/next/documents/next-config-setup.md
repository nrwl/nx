---
title: How to configure Next.js plugins
description: A guide for configuring Next.js plugins with Nx
---

# Configuring Next.js plugins

Next.js plugins are configured in the project's `next.config.js` file. Nx adds a its own plugin (`withNx`) to help the Next.js application
understand workspace libraries, and other Nx-specific features. See below for an example of the `withNx` plugin that Nx adds by default.

```js
// next.config.js

// ...

module.exports = withNx({
  // Nx configuration goes here
  nx: {
    svgr: false,
  },
  // Add Next.js configuration goes here
});
```

This guide contains information on how to configure and compose the Nx plugin with other plugins, such as `@next/mdx`. Note that Nx prior to version 16 is missing the compose utility from the `@nx/next` package, and a workaround will be provided for Nx 15 and prior.

{% callout type="warning" title="Avoid next-compose-plugins" %}
There is a popular package called `next-compose-plugins` that has not been maintained for over two years. This package does not correctly combine plugins in all situations. If you do use it, replace the package with Nx 16's `composePlugins` utility (see below).
{% /callout %}

## `withNx` plugin

The `withNx` Next.js plugin provides integration with Nx, including support for [workspace libraries](/packages/next/generators/library), SVGR, and more. It is included by default when you generate a Next.js [application](/packages/next/generators/application) with Nx. When you customize your `next.config.js` file, make sure to include the `withNx` plugin.

### Options

#### svgr

Type: `boolean`

Set this to true if you would like to to use SVGR. See: https://react-svgr.com/

#### babelUpwardRootMode

Type: `boolean`

For a monorepo, set to `true` to incorporate `.babelrc` files from individual libraries into the build. Note, however, that doing so will prevent the application's `.babelrc` settings from being applied to its libraries. It is generally recommended not to enable this option, as it can lead to a lack of consistency throughout the workspace. Instead, the application's `.babelrc` file should include the presets and plugins needed by its libraries directly. For more information on babel root-mode, see here: https://babeljs.io/docs/en/options#rootmode

Set this to `true` if you want `.babelrc` from libraries to be used in a monorepo. Note that setting this to `true` means the application's `.babelrc` will not apply to libraries, and it is recommended not to use this option as it may lead to inconsistency in the workspace. Instead, add babel presets/plugins required by libraries directly to the application's `.babelrc` file. See: https://babeljs.io/docs/en/options#rootmode

## Composing plugins using `composePlugins` utility (Nx 16 and later)

Since Nx 16, we provide a `composePlugins` utility function that helps users combine multiple Next.js plugins together.

```js
// next.config.js
const { composePlugins, withNx } = require('@nx/next');
/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
  // Add Next.js configuration here
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
```

If you want to add additional plugins, say [`@next/mdx`](https://www.npmjs.com/package/@next/mdx), you can add it to the plugins list.

```js
const plugins = [
  // Add more Next.js plugins to this list if needed.
  require('@next/mdx')(),
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
```

This the exported configuration will correctly call each plugin in order and apply their configuration changes to the final object. Note that `composePlugins` function will return an async function, so if you need to debug the configuration you can add a debug plugin as follows.

```js
module.exports = composePlugins(...plugins, function debug(config) {
  // The debug plugin will be called last
  console.log({ config });
  return config;
})(nextConfig);
```

## Manually composing plugins (Nx 15 and prior)

If you are not on Nx 16 and later versions, the `composePlugins` utility is not available. However, you can use the workaround below to use multiple plugins.

```js
// next.config.js

// ...

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  // ...
};

const plugins = [
  // Your plugins exlcuding withNx
];

module.exports = async (phase, context) => {
  let updatedConfig = plugins.reduce((acc, fn) => fn(acc), nextConfig);

  // Apply the async function that `withNx` returns.
  updatedConfig = await withNx(updatedConfig)(phase, context);

  // If you have plugins that has to be added after Nx you can do that here.
  // For example, Sentry needs to be added last.
  updatedConfig = require('@sentry/nextjs')(updatedConfig, { silent: true });

  return updatedConfig;
};
```
