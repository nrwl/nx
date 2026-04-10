---
title: 'Sharing Tailwind CSS Styles Across Apps in a Monorepo'
slug: 'sharing-tailwind-styles-nx-monorepo'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/articles/bg-tailwind-styles-share-monorepo.avif'
tags: [nx, tailwind, pnpm, monorepo, sync-generators]
description: 'Share Tailwind v4 design tokens across multiple apps in a pnpm + Nx monorepo using a shared styles package and automated @source directives.'
---

When you have multiple apps in a monorepo, you want consistent design tokens: colors, typography, spacing, shadows. Copy-pasting a Tailwind config between apps doesn't scale. Every time you tweak a color, you have to update it everywhere.

Tailwind v4 makes this simpler. The new CSS-first configuration with `@theme` means your design tokens live in a plain CSS file. In a pnpm/npm workspaces based monorepo you can put that CSS file in its own package and share it just as you'd do with your TypeScript packages.

This article walks through the mechanics of how to set that up. We'll create a shared styles package, consume it from multiple apps, and automate the Tailwind content scanning so it all stays in sync.

## The Workspace Structure

For the purpose of this demo I just created two apps and a shared styles project.

```
apps/
  shop/          # React + Vite app
  admin/         # React + Vite app
packages/
  shared/
    styles/      # Shared design tokens
```

Both apps use the same colors and typography, but they're completely independent otherwise.

## Step 1: Create the Shared Styles Package

Create a new folder in `packages/shared/styles`. Create a `package.json` with the following content:

```json
// packages/shared/styles/package.json
{
  "name": "@org/shared-styles",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/globals.css",
  "exports": {
    ".": "./src/globals.css",
    "./globals.css": "./src/globals.css"
  }
}
```

There's no build step involved. All we want to do is tell your package manager (pnpm/npm) where to find our `@org/shared-styles` package so we can import it.

The key is the `exports` field pointing directly to the CSS file. Any consumer can `@import '@org/shared-styles'` and get the tokens.

Here's an example of such CSS file using Tailwind v4's `@theme` directive:

```css
/* packages/shared/styles/src/globals.css */
@theme {
  --color-primary: oklch(55% 0.19 260);
  --color-primary-light: oklch(84% 0.07 255);
  --color-primary-dark: oklch(40% 0.17 262);

  --color-secondary: oklch(52% 0.14 175);
  --color-secondary-light: oklch(84% 0.08 175);

  --color-ink: oklch(26% 0.05 264);
  --color-ink-light: oklch(66% 0.01 258);
  --color-ink-lighter: oklch(92% 0.003 254);

  --color-canvas: oklch(97% 0.002 252);
  --color-success: oklch(55% 0.16 147);
  --color-error: oklch(59% 0.19 38);

  --font-sans: system-ui, -apple-system, sans-serif;
  --shadow-md: 0 4px 12px oklch(0% 0 0 / 10%);
  --radius-md: 0.5rem;
}
```

These become Tailwind utilities automatically. `--color-primary` gives you `bg-primary`, `text-primary`, `border-primary`, etc.

## Step 2: Consume the Shared Styles in an App

Each app needs three things:

**1. The `@tailwindcss/vite` plugin** in `vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), nxViteTsPaths()],
  // ...
}));
```

**2. A dependency on the shared styles** in `package.json`:

```json
{
  "devDependencies": {
    "@org/shared-styles": "workspace:*"
  }
}
```

**3. A CSS entry point** that imports Tailwind and the shared tokens:

```css
/* apps/shop/src/styles.css */
@import 'tailwindcss';
@import '@org/shared-styles';
```

That's it. You can now use `bg-primary`, `text-ink`, `shadow-md`, and all the other tokens from your shared package in any component.

The shop app uses `bg-primary` for its header.

![Shop app using shared primary color](/blog/images/articles/tailwind-shared-styles-shop.avif)

The admin app uses `bg-secondary`. Same tokens, different choices.

![Admin app using shared secondary color](/blog/images/articles/tailwind-shared-styles-admin.avif)

## Automating `@source` Directives

Tailwind v4 needs `@source` directives to know which files to scan for utility classes. In a monorepo, that means pointing at every library your app depends on. Maintaining those paths by hand gets fragile fast.

Nx has [sync generators](/docs/concepts/sync-generators) that can automate this. The [`@juristr/nx-tailwind-sync`](https://www.npmjs.com/package/@juristr/nx-tailwind-sync) package reads the project dependency graph and auto-manages `@source` directives on every build. For a deeper walkthrough on how this works, check out [this blog post](/blog/setup-tailwind-4-npm-workspace).

If you're not using Nx yet, you can add it to any existing pnpm or npm workspace by running `nx init` in the root of your project. It picks up your existing `package.json` scripts and workspace structure without requiring changes. From there you can wire up the sync generator.

```bash
npx nx@latest init
```

{% callout type="info" title="New to Nx?" %}
Check out our [pnpm + Nx course](/courses/pnpm-nx-next/lessons-01-nx-init) for a step-by-step walkthrough of adding Nx to an existing workspace.
{% /callout %}

## Full Example

The complete working example is on GitHub: [juristr/demo-monorepo-share-tailwind-styles](https://github.com/juristr/demo-monorepo-share-tailwind-styles).

Clone it, run `pnpm install`, then `pnpm nx dev shop` or `pnpm nx dev admin` to see both apps using the shared design tokens.

## Learn More

- [Nx Docs](/docs/getting-started/intro)
- [Configure Tailwind v4 with Vite in an npm Workspace](/blog/setup-tailwind-4-npm-workspace)
- [Nx Community Discord](https://go.nx.dev/community)
- [X / Twitter](https://twitter.com/nxdevtools)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx YouTube Channel](https://www.youtube.com/@nxdevtools)
