---
title: Using Tailwind CSS with React
description: Learn how to set up and configure Tailwind CSS in your React applications within an Nx workspace.
sidebar:
  label: 'Using Tailwind CSS with React'
filter: 'type:Guides'
---

This guide shows how to set up [Tailwind CSS](https://tailwindcss.com) in your React applications within an Nx workspace.

## Installation

For the most up-to-date installation instructions, refer to the official Tailwind CSS documentation:

- **Vite projects**: [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- **Next.js projects**: [Tailwind CSS with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- **Other setups**: [Tailwind CSS installation guide](https://tailwindcss.com/docs/installation)

## Configuring sources for monorepos

### Tailwind CSS v4

Tailwind CSS v4 [automatically detects classes from source files](https://tailwindcss.com/docs/detecting-classes-in-source-files). However, with the Vite plugin, scanning only covers the app directory. This means classes from workspace libraries won't be included unless you explicitly add them.

Use `@source` directives to include your library dependencies:

```css
// apps/myapp/src/styles.css
@import 'tailwindcss';

@source "../../../libs/ui";
@source "../../../libs/shared";
```

#### Automating @source directives

Manually maintaining `@source` directives is tedious and error-prone. Use [`@juristr/nx-tailwind-sync`](https://www.npmjs.com/package/@juristr/nx-tailwind-sync) to automate this based on your project's dependency graph.

Install the package:

```shell
npm install @juristr/nx-tailwind-sync
```

Register the sync generator for your application's `build` and `dev` targets:

{% tabs syncKey="project-config-file" %}
{% tabitem label="package.json" %}

```json
{
  "name": "myapp",
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"]
      },
      "dev": {
        "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"]
      }
    }
  }
}
```

{% /tabitem %}
{% tabitem label="project.json" %}

```json
{
  "name": "myapp",
  "targets": {
    "build": {
      "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"]
    },
    "dev": {
      "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"]
    }
  }
}
```

{% /tabitem %}
{% /tabs %}

When you run `nx build myapp` or `nx dev myapp`, the sync generator analyzes your dependency graph and updates your stylesheet with the correct `@source` directives automatically.

For more details on why this is necessary and how to build your own sync generator, see [Tailwind v4 with Vite in an NPM Workspace](/blog/setup-tailwind-4-npm-workspace).

### Tailwind CSS v3

For Tailwind CSS v3, the [`content`](https://v3.tailwindcss.com/docs/content-configuration) property should be configured to include glob patterns that cover your project and its dependencies:

```javascript
// apps/my-app/tailwind.config.js
const { join } = require('path');

module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*.{ts,tsx,js,jsx}'),
    join(__dirname, '../../libs/**/*.{ts,tsx,js,jsx}'),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

You can adjust the glob patterns based on your workspace structure. For example, you can be more selective by targeting individual libraries such as `libs/my-lib` rather than all libraries (`libs`). To learn how to automatically sync library dependencies with Tailwind sources, watch our video [Never Update Tailwind Glob Patterns Manually Again](https://www.youtube.com/watch?v=huTmV-F8c0A).
