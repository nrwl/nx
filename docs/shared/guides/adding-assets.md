---
title: Adding Images, Fonts, and Files
description: Learn how to import and use assets like images, fonts, and files directly in your Nx projects, including special handling for SVGs in React, Next.js, and Vite applications.
---

# Adding Images, Fonts, and Files

With Nx, you can **`import` assets directly from your TypeScript/JavaScript code**.

```typescript
import React from 'react';
import logo from './logo.png';

const Header = () => <img src={logo} alt="Logo" />;

export default Header;
```

This import will be replaced by a string of the image path when the application builds. To reduce the number of network requests, if the image file size is less than 10 kB, then the image will be inlined using [data URI](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) instead of a path.

This works in CSS files as well.

```css
.logo {
  background-image: url(./logo.png);
}
```

## Adding SVGs

SVG images can be imported using the method described previously.

Alternatively, you can import SVG images as React components using [SVGR](https://react-svgr.com/).

```typescript
import React from 'react';
import { ReactComponent as Logo } from './logo.svg';

const Header = () => <Logo title="Logo" />;

export default Header;
```

This method of import allow you to work with the SVG the same way you would with any other React component. You can style it using CSS, [styled-components](https://styled-components.com/), [TailwindCSS](https://tailwindcss.com/), etc. The SVG component accepts a `title` prop, as well as any other props that the `svg` element accepts.

{% callout type="note" title="Additional configuration may be required" %}
Note that SVGR is enabled by the `@nx/webpack` plugin by default. For other plugins, you will need to enable it on your own.
{% /callout %}

### SVGR for Next.js

To import SVGs as React components with Next.js, you need to make sure that `nx.svgr` value is set to `true` in your Next.js application's `next.config.js` file:

```javascript {% fileName="next.config.js" highlightLines=[4] %}
// ...
const nextConfig = {
  nx: {
    svgr: true,
  },
};
// ...
module.exports = composePlugins(...plugins)(nextConfig);
```

### SVGR for Vite

To import SVGs as React components with Vite, you need to install the `vite-plugin-svgr` package.

{% tabs %}
{%tab label="npm"%}

```shell
npm add -D vite-plugin-svgr
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add -D vite-plugin-svgr
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add -D vite-plugin-svgr
```

{% /tab %}

{% tab label="bun" %}

```shell
bun add -D vite-plugin-svgr
```

{% /tab %}
{% /tabs %}

Then, configure Vite as follows:

```javascript {% fileName="vite.config.ts" highlightLines=[5, "10-18"]%}
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
