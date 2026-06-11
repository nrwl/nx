---
title: How to configure Next.js plugins
description: A guide for configuring Next.js plugins with Nx
sidebar:
  label: 'How to configure Next.js plugins'
filter: 'type:References'
---

Next.js plugins are configured in the project's `next.config.js` file. Nx adds its own plugin (`withNx`) to help the Next.js application
understand workspace libraries, and other Nx-specific features. See below for an example of the `withNx` plugin that Nx adds by default.

```js frame="none"
// next.config.js

// ...

module.exports = withNx({
  // Nx configuration goes here
  nx: {
    babelUpwardRootMode: true,
  },
  // Add Next.js configuration goes here
});
```

You can configure and compose the Nx plugin with other plugins, such as `@next/mdx`.

{% aside type="caution" title="Avoid next-compose-plugins" %}
There is a popular package called `next-compose-plugins` that has not been maintained for over two years. This package does not correctly combine plugins in all situations. If you do use it, replace the package with Nx 16's `composePlugins` utility (see below).
{% /aside %}

## `withNx` plugin

The `withNx` Next.js plugin provides integration with Nx, including support for [workspace libraries](/docs/technologies/react/next/generators#library), SVGR, and more. It is included by default when you generate a Next.js [application](/docs/technologies/react/next/generators#application) with Nx. When you customize your `next.config.js` file, make sure to include the `withNx` plugin.

### Options

#### svgr

Type: `boolean`

Set this to true if you would like to use SVGR. See: https://react-svgr.com/

**Deprecated:** Configure SVGR support in your `next.config.js` file without Nx. This option will be removed in Nx 22. See: https://react-svgr.com/docs/next/

#### babelUpwardRootMode

Type: `boolean`

For a monorepo, set to `true` to incorporate `.babelrc` files from individual libraries into the build. Note, however, that doing so will prevent the application's `.babelrc` settings from being applied to its libraries. It is generally recommended not to enable this option, as it can lead to a lack of consistency throughout the workspace. Instead, the application's `.babelrc` file should include the presets and plugins needed by its libraries directly. For more information on babel root-mode, see here: https://babeljs.io/docs/en/options#rootmode

## Composing plugins using `composePlugins` utility

The `composePlugins` utility function helps you combine multiple Next.js plugins together.

```js frame="none"
// next.config.js
const { composePlugins, withNx } = require('@nx/next');
/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    svgr: true,
    babelUpwardRootMode: true,
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

```js frame="none"
const plugins = [
  // Add more Next.js plugins to this list if needed.
  require('@next/mdx')(),
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig);
```

The exported configuration will correctly call each plugin in order and apply their configuration changes to the final object. Note that `composePlugins` function will return an async function, so if you need to debug the configuration you can add a debug plugin as follows.

```js frame="none"
module.exports = composePlugins(...plugins, function debug(config) {
  // The debug plugin will be called last
  console.log({ config });
  return config;
})(nextConfig);
```
