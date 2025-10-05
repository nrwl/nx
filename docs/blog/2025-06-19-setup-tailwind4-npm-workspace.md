---
title: 'Configure Tailwind 4 with Vite in an NPM Workspace: The Complete Guide'
slug: setup-tailwind-4-npm-workspace
authors: ['Juri Strumpflohner']
tags: ['nx', 'tailwind', 'vite', 'npm-workspaces', 'sync-generators']
cover_image: /blog/images/articles/bg-tailwind-4-guide.avif
description: 'Learn how to set up Tailwind CSS v4 with Vite in an NPM workspace monorepo, and automate your configuration with Nx Sync Generators for optimal performance.'
youtubeUrl: https://youtu.be/tg3LnqhNNws
---

Tailwind CSS v4 brings revolutionary changes to how we configure and use the popular utility-first framework. The simplified setup eliminates configuration files and complex PostCSS setups - you just install, import, and start building. But when working in NPM workspaces or monorepos, there's still one crucial challenge: **how do you tell Tailwind which packages to scan for classes?**

This guide walks you through setting up Tailwind v4 with Vite in an NPM workspace, then shows you how to automate the configuration using Nx Sync Generators to **eliminate manual maintenance**.

{% github-repository url="https://github.com/juristr/tailwind4-vite-npm-workspaces" /%}

{% toc /%}

## Setting up Tailwind v4

[Tailwind v4](https://tailwindcss.com/blog/tailwindcss-v4) introduced some nice simplifications when it comes to configuring Tailwind:

- **No more `tailwind.config.js`** - The framework works out of the box
- **Minimal dependencies** - Just `tailwindcss` and `@tailwindcss/vite` for Vite projects
- **Simple CSS import** - Add `@import "tailwindcss"` to your stylesheet and you're ready

Since we're using Vite in this workspace, we can leverage the dedicated Tailwind Vite plugin instead of PostCSS configuration. Here's what you need:

Install the required packages at your workspace root:

```json {% fileName="package.json" %}
{
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

Configure your Vite setup:

```typescript {% fileName="apps/shop/vite.config.ts" %}
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // ... rest of your config
});
```

Add the import to your main CSS file:

```css {% fileName="apps/shop/src/styles.css" %}
@import 'tailwindcss';
```

## The NPM workspace challenge

Consider a typical e-commerce application structured as an NPM workspace:

```plain
apps/
  shop/
    src                  <<<< where tailwind is configured
packages/
  products/
    feat-product-list/
    feat-product-detail/
    data-access-products/
  shared/
    ui/
    utils/
```

At this point, your application will build and serve, but you'll notice that styles from your `packages/` are missing. In this modular setup, your main application (`shop`) depends on various feature packages, but **Tailwind only scans the main app by default**. This means styles defined in your packages won't be included in the final bundle, leading to missing styles and broken layouts.

## Solving the scanning problem with @source directives

Tailwind v4 introduces the `@source` directive to address exactly this problem. You can explicitly tell Tailwind which directories to scan by adding these directives to your CSS file:

```css {% fileName="apps/shop/src/styles.css" %}
@import 'tailwindcss';

@source "../../../packages/products/feat-product-list";
@source "../../../packages/products/feat-product-detail";
@source "../../../packages/shared/ui";
...
```

With these directives in place, Tailwind will scan the specified packages and include any utility classes found there. Your application styles will now work correctly across all packages.

## Automating @source entries - enter Nx sync generators

While `@source` directives solve the technical problem, they introduce a maintenance challenge:

- **manual updates required** when adding or removing dependencies,
- **easy to forget updating** the directives,
- **hard-to-debug issues** since missing styles don't break builds (just cause visual problems), and
- **team coordination** since every developer needs to remember to update these paths.

This is where automation becomes crucial and where Nx can help. [Nx Sync Generators](/concepts/sync-generators) provide a powerful solution for **automating configuration that needs to stay in sync with your project structure**.

For our specific use case we can automate the generation of the `@source` directives by

- analyzing and traversing all of the `shop` application's dependencies (leveraging the [Nx project graph](/features/explore-graph))
- generating the `@source` entries into the correct `styles.css` file

You can follow [the guide on the Nx docs](/extending-nx/recipes/create-sync-generator) for all the details on how to implement your own Nx sync generator. At a high level these are the steps you'll need:

**Step 1: Add Nx Plugin development support**

```shell
npx nx add @nx/plugin
```

**Step 2: Generate a new plugin into your workspace**

```shell
npx nx g @nx/plugin:plugin tools/tailwind-sync-plugin
```

Note, you can choose whatever folder you like. I happen to use the `tools/` folder for this example.

**Step 3: Generate a sync generator**

```shell
npx nx g @nx/plugin:generator --name=update-tailwind-globs --path=tools/tailwind-sync-plugin/src/generators/update-tailwind-globs
```

With that you have the infrastructure in place and we can look at the actual implementation of the sync generator:

```typescript
import { Tree, createProjectGraphAsync, joinPathFragments } from '@nx/devkit';
import { SyncGeneratorResult } from 'nx/src/utils/sync-generators';

export async function updateTailwindGlobsGenerator(
  tree: Tree
): Promise<SyncGeneratorResult> {
  const appName = '@aishop/shop';
  const projectGraph = await createProjectGraphAsync();

  // Traverse all dependencies of the shop app
  const dependencies = new Set<string>();
  const queue = [appName];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const deps = projectGraph.dependencies[current] || [];
    deps.forEach((dep) => {
      dependencies.add(dep.target);
      queue.push(dep.target);
    });
  }

  // Generate @source directives for each dependency
  const sourceDirectives: string[] = [];
  dependencies.forEach((dep) => {
    const project = projectGraph.nodes[dep];
    if (project && project.data.root) {
      const relativePath = joinPathFragments('../../../', project.data.root);
      sourceDirectives.push(`@source "${relativePath}";`);
    }
  });

  // Update the styles.css file
  const stylesPath = 'apps/shop/src/styles.css';
  const currentContent = tree.read(stylesPath)?.toString() || '';

  // Insert the @source directives after @import "tailwindcss"
  // ... (implementation details)

  return {
    outOfSyncMessage: 'Tailwind @source directives updated',
  };
}
```

_(Check out the [Github repo for the full implementation](https://github.com/juristr/tailwind4-vite-npm-workspaces))_

You can manually run sync generators with `nx sync`, but we want this to run automatically whenever we build or serve our application. As such we can register the sync generator in the app's `package.json`:

```json {% fileName="apps/shop/package.json" %}
{
  "name": "@aishop/shop",
  ...
  "nx": {
    "targets": {
      "build": {
        "syncGenerators": ["@aishop/tailwind-sync-plugin:update-tailwind-globs"]
      },
      "serve": {
        "syncGenerators": ["@aishop/tailwind-sync-plugin:update-tailwind-globs"]
      }
    }
  }
}
```

## Nx sync generators in action

When you run your development server with `nx serve shop`, the sync generator automatically checks if your `@source` directives are up to date:

![Tailwind Nx sync generator in action](/blog/images/articles/tailwind-sync-generator.avif)

Your CSS file is automatically updated with the correct directives based on your actual project dependencies. If you add or remove dependencies later, the next build or serve will **detect the changes and update the configuration automatically**.

You can find the complete implementation in this [GitHub repository](https://github.com/juristr/tailwind4-vite-npm-workspaces).

## Using Tailwind v3?

If you're currently using Tailwind v3, the concept is similar but the implementation differs. Instead of updating `@source` directives, you'd modify the `tailwind.config.js` file with glob patterns.

Check out the following video which explains the same approach for Tailwind v3:

{% youtube src="https://www.youtube.com/watch?v=huTmV-F8c0A" title="Optimizing Tailwind with Nx Sync Generators (v3)" /%}

The [Tailwind v3 demo repository](https://github.com/juristr/tailwind-sync-demo) shows how to implement this approach for older versions.

## Conclusion

While Tailwind v4's simplified setup is a significant improvement, manually maintaining `@source` directives creates a maintenance burden in monorepos. Nx Sync Generators solve this by automatically keeping your Tailwind configuration in sync with your project dependencies, eliminating manual updates and preventing hard-to-debug styling issues.

This approach transforms configuration maintenance into a completely automated process, letting you focus on building features rather than managing paths.

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Tailwind v4 Vite NPM Workspace Demo](https://github.com/juristr/tailwind4-vite-npm-workspaces)
- 📖 [Nx Sync Generators Documentation](/extending-nx/recipes/create-sync-generator)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 🐦 [Follow me on Twitter/X](https://twitter.com/juristr)
