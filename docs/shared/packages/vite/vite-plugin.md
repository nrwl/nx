---
title: Overview of the Nx Vite Plugin
description: The Nx Plugin for Vite contains executors and generators that support building applications using Vite. This page also explains how to configure Vite on your Nx workspace.
---

The Nx plugin for [Vite](https://vitejs.dev/) and [Vitest](https://vitest.dev/).

[Vite.js](https://vitejs.dev/) is a build tool that aims to provide a faster and leaner development experience for modern web projects.

Why should you use this plugin?

- Instant dev server start
- Lightning fast Hot-Module Reloading
- _Fast_ builds using Vite.
- Vite-powered tests with smart and instant watch mode

Read more about Vite and Vitest in the [Vite documentation](https://vitejs.dev/).

## Setting up a new Nx workspace with @nx/vite

Here's an example on how to create a new React app with Vite

```shell
npx create-nx-workspace@latest --preset=react-standalone --bundler=vite
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/vite` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/vite` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/vite
```

You can also pass the `--setupPathsPlugin` flag to add [`nxViteTsPaths` plugin](/recipes/vite/configure-vite#typescript-paths), so your projects can use workspace libraries.

```shell {% skipRescope=true %}
nx add @nx/vite --setupPathsPlugin
```

This will install the correct version of `@nx/vite`.

### How @nx/vite Infers Tasks

The `@nx/vite` plugin will create a task for any project that has a Vite configuration file present. Any of the following files will be recognized as a Vite configuration file:

- `vite.config.js`
- `vite.config.ts`
- `vite.config.mjs`
- `vite.config.mts`
- `vite.config.cjs`
- `vite.config.cts`
- `vitest.config.js`
- `vitest.config.ts`
- `vitest.config.mjs`
- `vitest.config.mts`
- `vitest.config.cjs`
- `vitest.config.cts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/vite Configuration

The `@nx/vite/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/vite/plugin",
      "options": {
        "buildTargetName": "build",
        "previewTargetName": "preview",
        "testTargetName": "test",
        "serveTargetName": "serve",
        "serveStaticTargetName": "serve-static"
      }
    }
  ]
}
```

The `buildTargetName`, `previewTargetName`, `testTargetName`, `serveTargetName` and `serveStaticTargetName` options control the names of the inferred Vite tasks. The default names are `build`, `preview`, `test`, `serve` and `serve-static`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/vite` package with your package manager.

```shell
npm add -D @nx/vite
```

{% /tab %}
{% /tabs %}

## Using @nx/vite

### Generate a new project using Vite

You can generate a [React](/nx-api/react) application or library or a [Web](/nx-api/web) application that uses Vite.js. The [`@nx/react:app`](/nx-api/react/generators/application), [`@nx/react:lib`](/nx-api/react/generators/library) and [`@nx/web:app`](/nx-api/web/generators/application) generators accept the `bundler` option, where you can pass `vite`. This will generate a new application configured to use Vite.js, and it will also install all the necessary dependencies, including the `@nx/vite` plugin.

To generate a React application using Vite.js, run the following:

```bash
nx g @nx/react:app my-app --bundler=vite
```

To generate a React library using Vite.js, run the following:

```bash
nx g @nx/react:lib my-lib --bundler=vite
```

To generate a Web application using Vite.js, run the following:

```bash
nx g @nx/web:app my-app --bundler=vite
```

### Modify an existing React or Web project to use Vite.js

You can use the `@nx/vite:configuration` generator to change your React or Web project to use Vite.js. This generator will modify your project's configuration to use Vite.js, and it will also install all the necessary dependencies, including the `@nx/vite` plugin..

You can read more about this generator on the [`@nx/vite:configuration`](/nx-api/vite/generators/configuration) generator page.
