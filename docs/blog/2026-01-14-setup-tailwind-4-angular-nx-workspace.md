---
title: 'Configure Tailwind v4 with Angular in an Nx Monorepo'
slug: setup-tailwind-4-angular-nx-workspace
authors: ['Juri Strumpflohner']
tags: [nx, tailwind, angular, monorepo, sync-generators]
description: 'Learn how Tailwind CSS v4 scanning works with Angular in Nx monorepos, why you may have bloated CSS, and how to optimize it with @source directives and Nx Sync Generators.'
youtubeUrl: https://youtu.be/plpniZ7HkSA
cover_image: /blog/images/articles/header-img-angular-tailwind4-nx.avif
---

Tailwind CSS v4 brought significant simplifications: no more `tailwind.config.js`, minimal dependencies, and a simple CSS import to get started. But if you're using Angular with Tailwind v4 in an Nx monorepo, there's a catch: **your production CSS might be larger than it needs to be**.

This article explains how Tailwind v4's scanning works with Angular's PostCSS setup, why it can lead to bloated CSS output, and how to optimize it using `@source` directives and Nx Sync Generators.

{% callout type="note" title="Using Vite in an NPM Workspace?" %}
If you're using Vite (React, Vue, etc.) rather than Angular, check out [Tailwind v4 with Vite in an NPM Workspace](/blog/setup-tailwind-4-npm-workspace) instead.
{% /callout %}

{% toc /%}

## Setting Up Tailwind v4 with Angular

Setting up Tailwind v4 with Angular is straightforward. Both the [Angular docs](https://angular.dev/guide/tailwind) and [Tailwind docs](https://tailwindcss.com/docs/installation/framework-guides/angular) have guides for this. But they miss one important aspect when working in a monorepo, which is what we're digging into today.

Since Angular uses PostCSS for CSS processing, you need the PostCSS plugin.

Install the required packages:

```json {% fileName="package.json" %}
{
  "dependencies": {
    "@tailwindcss/postcss": "^4.1.13",
    "tailwindcss": "^4.1.13"
  }
}
```

Configure PostCSS in your application:

```json {% fileName="apps/demoapp/.postcssrc.json" %}
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

Import Tailwind in your styles entry point:

```css {% fileName="apps/demoapp/src/styles.css" %}
@import 'tailwindcss';
```

That's it. Your Angular app now has Tailwind v4 configured. But here's where things get interesting in a monorepo setup.

## The Problem: Over-Scanning in Monorepos

Consider a typical Nx workspace structure:

```
apps/
  demoapp/           # Your Angular application
libs/
  ui-design-system/  # Shared UI components (used by demoapp)
  another-ui/        # Another library (NOT used by demoapp)
```

When you run `nx build demoapp`, you'd expect only the Tailwind classes from `demoapp` and its dependency `ui-design-system` to end up in the final CSS. But that's not what happens by default.

Let's say `another-ui` has a component with this template:

```html {% fileName="libs/another-ui/src/lib/another-ui/another-ui.html" %}
<p class="text-red-500">AnotherUi works!</p>
```

Even though `demoapp` never imports `another-ui`, if you check your production CSS output, you'll find `text-red-500` in there. This happens for every unused class in every library in your workspace.

### Why Does This Happen?

The `@tailwindcss/postcss` plugin uses `process.cwd()` as its default scanning base:

```typescript
// @tailwindcss/postcss source
let base = opts.base ?? process.cwd();
```

When you run `nx build demoapp`, `process.cwd()` is your workspace root. Tailwind scans from there, finding all `.html`, `.ts`, and other template files across your entire monorepo.

This is different from the `@tailwindcss/vite` plugin, which uses the Vite config root (typically the app directory) as its base. With Vite you have the opposite problem: not enough is included by default, so you must explicitly add library sources. If you're using Vite with React or other frameworks, check out the [Tailwind v4 with Vite in an NPM Workspace](/blog/setup-tailwind-4-npm-workspace) guide.

You could restrict the scanning by providing the `base` property in your PostCSS config:

```json {% fileName="apps/demoapp/.postcssrc.json" %}
{
  "plugins": {
    "@tailwindcss/postcss": {
      "base": "./apps/demoapp/src"
    }
  }
}
```

But then you'd need to manually add `@source` directives for all your library dependencies. We'll look at a more automated approach.

### Comparing PostCSS vs Vite Plugin Behavior

| Plugin                 | Default Base    | Monorepo Behavior        | Needs `@source` for libs?            |
| ---------------------- | --------------- | ------------------------ | ------------------------------------ |
| `@tailwindcss/postcss` | `process.cwd()` | Scans entire workspace   | Only if you restrict with `source()` |
| `@tailwindcss/vite`    | `config.root`   | Scans app directory only | Yes, always                          |

With the PostCSS plugin, you get all classes from all libraries. With the Vite plugin, you get only classes from the app and must explicitly add library sources. Both approaches benefit from automation to manage `@source` directives.

## Solution: Restricting Scanning with @source Directives

Tailwind v4 provides the `source()` function and `@source` directive to control which directories get scanned.

### Step 1: Restrict Automatic Scanning

Update your styles entry point to limit automatic scanning to just your app:

```css {% fileName="apps/demoapp/src/styles.css" %}
@import 'tailwindcss' source('./app');
```

The `source("./app")` modifier tells Tailwind to only auto-scan the `app` subdirectory relative to this CSS file.

### Step 2: Add Library Dependencies

Now you need to explicitly add your library dependencies:

```css {% fileName="apps/demoapp/src/styles.css" %}
@import 'tailwindcss' source('./app');

@source "../../../libs/ui-design-system/src";
```

With this configuration:

- Classes from `apps/demoapp/src/app/**` are included (via `source("./app")`)
- Classes from `libs/ui-design-system/src/**` are included (via `@source`)
- Classes from `libs/another-ui/**` are NOT included

Your production CSS now contains only what you actually use.

## Automating @source with Nx Sync Generators

Manually maintaining `@source` directives works, but introduces maintenance burden:

- Easy to forget when adding new dependencies
- Missing styles don't break builds (just cause visual bugs)
- Every team member needs to remember to update paths

[Nx Sync Generators](/docs/concepts/sync-generators) solve this by automatically keeping your `@source` directives in sync with your project dependencies.

### Using @juristr/nx-tailwind-sync

In the [Tailwind v4 with Vite in an NPM Workspace](/blog/setup-tailwind-4-npm-workspace) article, I explained how to build a custom sync generator to automate `@source` directive management. I've since packaged this into [`@juristr/nx-tailwind-sync`](https://www.npmjs.com/package/@juristr/nx-tailwind-sync) so you can use it directly.

Install it:

```shell
npm install @juristr/nx-tailwind-sync
```

Register the sync generator in your application's `project.json`:

```json {% fileName="apps/demoapp/project.json" %}
{
  "name": "demoapp",
  "targets": {
    "build": {
      "executor": "@angular/build:application",
      "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"],
      ...
    },
    "serve": {
      "executor": "@angular/build:dev-server",
      "syncGenerators": ["@juristr/nx-tailwind-sync:source-directives"],
      ...
    }
  }
}
```

Now when you run `nx build demoapp` or `nx serve demoapp`, the sync generator:

1. Analyzes your application's dependency graph
2. Generates `@source` directives for each dependency
3. Updates your `styles.css` automatically

Your styles file gets managed markers:

```css {% fileName="apps/demoapp/src/styles.css" %}
@import 'tailwindcss' source('./app');

/* nx-tailwind-sources:start */
@source "../../../libs/ui-design-system";
/* nx-tailwind-sources:end */
```

When you add a new library dependency, the next build or serve detects the change and updates the directives automatically.

### How Sync Generators Work

Sync generators run before certain targets (like `build` or `serve`) and check if generated files are in sync with your source code. If something is out of sync, Nx prompts you to apply the changes.

This is the same mechanism Nx uses to keep TypeScript project references in sync with your dependency graph. Learn more in the [Sync Generators documentation](/docs/concepts/sync-generators).

## Alternative: PostCSS Plugin Approach

Community member [Poul Hansen](https://x.com/insanicae) created a PostCSS plugin that achieves similar automation at build time rather than through sync generators.

This approach uses the `createGlobPatternsForDependencies` function from `@nx/angular/tailwind` to dynamically inject sources during the PostCSS processing phase. Check out the [gist](https://gist.github.com/Phhansen/66cd0e4baeabe154d7d20691d709a421) for implementation details.

## Conclusion

Tailwind v4's simplified setup is great for standalone projects, but requires attention in monorepos. With Angular's PostCSS-based setup, the default behavior scans your entire workspace, potentially bloating your production CSS with unused classes.

By combining `source()` restrictions with `@source` directives and automating their maintenance through Nx Sync Generators, you get optimal CSS output without manual upkeep.

## Learn More

- [Nx Docs](/docs/getting-started/intro)
- [Tailwind v4 with Vite in an NPM Workspace](/blog/setup-tailwind-4-npm-workspace)
- [@juristr/nx-tailwind-sync on npm](https://www.npmjs.com/package/@juristr/nx-tailwind-sync)
- [Nx Sync Generators Documentation](/docs/concepts/sync-generators)
- [Tailwind CSS: Detecting Classes in Source Files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Nx YouTube Channel](https://www.youtube.com/@nxdevtools)
