---
title: Adding Images, Fonts, and Files
description: Learn how to import and use assets like images, fonts, and files directly in your Nx projects, including special handling for SVGs in React, Next.js, and Vite applications.
sidebar:
  label: 'Adding Images, Fonts, and Files'
filter: 'type:Guides'
---

With Nx, you can **`import` assets directly from your TypeScript/JavaScript code**.

```typescript frame="none"
import React from 'react';
import logo from './logo.png';

const Header = () => <img src={logo} alt="Logo" />;

export default Header;
```

This import will be replaced by a string of the image path when the application builds. To reduce the number of network requests, if the image file size is less than 10 kB, then the image will be inlined using [data URI](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) instead of a path.

This works in CSS files as well.

```css frame="none"
.logo {
  background-image: url(./logo.png);
}
```

## Adding SVGs

SVG images can be imported using the method described previously.

Alternatively, you can import SVG images as React components using [SVGR](https://react-svgr.com/).

```typescript frame="none"
import React from 'react';
import { ReactComponent as Logo } from './logo.svg';

const Header = () => <Logo title="Logo" />;

export default Header;
```

This method of import allow you to work with the SVG the same way you would with any other React component. You can style it using CSS, [styled-components](https://styled-components.com/), [TailwindCSS](https://tailwindcss.com/), etc. The SVG component accepts a `title` prop, as well as any other props that the `svg` element accepts.

{% aside type="caution" title="Manual Configuration Required" %}
As of Nx 22, SVGR is removed for Webpack and Next.js, and deprecated for Rspack (will be removed in Nx 23). Manual configuration is required—see the sections below.
{% /aside %}

### SVGR for Webpack and Rspack

To import SVGs as React components with Webpack or Rspack, you need to install the `@svgr/webpack` package and configure it manually. For detailed configuration options, refer to the [official SVGR webpack documentation](https://react-svgr.com/docs/webpack/).

First, install the required dependencies:

{% tabs %}
{% tabitem label="npm" %}

```shell
npm add -D @svgr/webpack file-loader
```

{% /tabitem %}
{% tabitem label="yarn" %}

```shell
yarn add -D @svgr/webpack file-loader
```

{% /tabitem %}
{% tabitem label="pnpm" %}

```shell
pnpm add -D @svgr/webpack file-loader
```

{% /tabitem %}

{% tabitem label="bun" %}

```shell
bun add -D @svgr/webpack file-loader
```

{% /tabitem %}
{% /tabs %}

Then, configure your webpack config:

```javascript frame="none"
// filename: webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.svg$/,
        issuer: /\.(js|ts|md)x?$/,
        use: [
          {
            loader: '@svgr/webpack',
            options: {
              svgo: false,
              titleProp: true,
              ref: true,
            },
          },
          'file-loader',
        ],
      },
    ],
  },
};
```

If you're using `composePlugins` with `withNx`, you can create a `withSvgr` helper function:

```javascript frame="none"
// filename: webpack.config.js
const { composePlugins, withNx } = require('@nx/webpack');

function withSvgr(svgrOptions = {}) {
  const defaultOptions = {
    svgo: false,
    titleProp: true,
    ref: true,
  };

  const options = { ...defaultOptions, ...svgrOptions };

  return function configure(config) {
    // Remove existing SVG loader if present
    const svgLoaderIdx = config.module.rules.findIndex(
      (rule) =>
        typeof rule === 'object' &&
        typeof rule.test !== 'undefined' &&
        rule.test.toString().includes('svg')
    );

    if (svgLoaderIdx !== -1) {
      config.module.rules.splice(svgLoaderIdx, 1);
    }

    // Add SVGR loader
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.(js|ts|md)x?$/,
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options,
        },
        {
          loader: require.resolve('file-loader'),
          options: {
            name: '[name].[hash].[ext]',
          },
        },
      ],
    });

    return config;
  };
}

module.exports = composePlugins(withNx(), withSvgr());
```

### SVGR for Next.js

As of Nx 22, SVGR support for Next.js is no longer included by default. You can configure it manually using the same approach as Webpack. For detailed information, refer to the [official SVGR documentation](https://react-svgr.com/docs/webpack/).

First, install the required dependencies:

{% tabs %}
{% tabitem label="npm" %}

```shell
npm add -D @svgr/webpack file-loader
```

{% /tabitem %}
{% tabitem label="yarn" %}

```shell
yarn add -D @svgr/webpack file-loader
```

{% /tabitem %}
{% tabitem label="pnpm" %}

```shell
pnpm add -D @svgr/webpack file-loader
```

{% /tabitem %}

{% tabitem label="bun" %}

```shell
bun add -D @svgr/webpack file-loader
```

{% /tabitem %}
{% /tabs %}

Then, update your `next.config.js`:

```javascript frame="none"
// filename: next.config.js
module.exports = {
  webpack(config) {
    // Grab the existing rule that handles SVG imports
    const fileLoaderRule = config.module.rules.find((rule) =>
      rule.test?.test?.('.svg')
    );

    config.module.rules.push(
      // Reapply the existing rule, but only for svg imports ending in ?url
      {
        ...fileLoaderRule,
        test: /\.svg$/i,
        resourceQuery: /url/, // *.svg?url
      },
      // Convert all other *.svg imports to React components
      {
        test: /\.svg$/i,
        issuer: fileLoaderRule.issuer,
        resourceQuery: { not: [...fileLoaderRule.resourceQuery.not, /url/] }, // exclude if *.svg?url
        use: ['@svgr/webpack'],
      }
    );

    // Modify the file loader rule to ignore *.svg, since we have it handled now.
    fileLoaderRule.exclude = /\.svg$/i;

    return config;
  },

  // ...other config
};
```

If you're using `composePlugins` with `withNx`, you can update your `next.config.js` to use a `withSvgr` helper function:

```javascript frame="none"
// filename: next.config.js
const { composePlugins, withNx } = require('@nx/next');

function withSvgr(svgrOptions = {}) {
  const defaultOptions = {
    svgo: false,
    titleProp: true,
    ref: true,
  };

  const options = { ...defaultOptions, ...svgrOptions };

  return function configure(config) {
    // Remove existing SVG loader if present
    const svgLoaderIdx = config.module.rules.findIndex(
      (rule) =>
        typeof rule === 'object' &&
        typeof rule.test !== 'undefined' &&
        rule.test.toString().includes('svg')
    );

    if (svgLoaderIdx !== -1) {
      config.module.rules.splice(svgLoaderIdx, 1);
    }

    // Add SVGR loader
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.(js|ts|md)x?$/,
      use: [
        {
          loader: require.resolve('@svgr/webpack'),
          options,
        },
        {
          loader: require.resolve('file-loader'),
          options: {
            name: '[name].[hash].[ext]',
          },
        },
      ],
    });

    return config;
  };
}

const nextConfig = {
  // your Next.js config here
};

module.exports = composePlugins(withNx(), withSvgr())(nextConfig);
```

### SVGR for Vite

To import SVGs as React components with Vite, you need to install the `vite-plugin-svgr` package.

{% tabs %}
{% tabitem label="npm" %}

```shell
npm add -D vite-plugin-svgr
```

{% /tabitem %}
{% tabitem label="yarn" %}

```shell
yarn add -D vite-plugin-svgr
```

{% /tabitem %}
{% tabitem label="pnpm" %}

```shell
pnpm add -D vite-plugin-svgr
```

{% /tabitem %}

{% tabitem label="bun" %}

```shell
bun add -D vite-plugin-svgr
```

{% /tabitem %}
{% /tabs %}

Then, configure Vite as follows:

```javascript frame="none" meta="{ranges: '5,10-18'}"
// filename: vite.config.ts
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  // ...
  plugins: [
    svgr({
      svgrOptions: {
        exportType: 'named',
        ref: true,
        svgo: false,
        titleProp: true,
      },
      include: '**/*.svg',
    }),
    react(),
    nxViteTsPaths(),
    // ...
  ],
  //...
});
```
