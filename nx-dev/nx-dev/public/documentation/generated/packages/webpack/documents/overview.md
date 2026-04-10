---
title: Overview of the Nx Webpack Plugin
description: The Nx Plugin for Webpack contains executors and generators that support building applications using Webpack.
---

The Nx plugin for [webpack](https://webpack.js.org/).

[Webpack](https://webpack.js.org/) is a static module bundler for modern JavaScript applications. The `@nx/webpack` plugin provides executors that allow you to build and serve your projects using webpack, plus an executor for SSR.

Nx now allows you to [customize your webpack configuration](/recipes/webpack/webpack-config-setup) for your projects. And we also offer [a number of webpack plugins](/recipes/webpack/webpack-plugins) for supporting Nx and other frameworks.

## Setting up a new Nx workspace with Webpack

You can create a new workspace that uses Webpack with one of the following commands:

- Generate a new standalone React app set up with Webpack

```shell
npx create-nx-workspace@latest --preset=react-standalone --bundler=webpack
```

- Generate a new React monorepo set up with Webpack

```shell
npx create-nx-workspace@latest --preset=react-monorepo --bundler=webpack
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/webpack` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/webpack` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/webpack
```

This will install the correct version of `@nx/webpack`.

### How @nx/webpack Infers Tasks

The `@nx/webpack` plugin will create a task for any project that has a Webpack configuration file present. Any of the following files will be recognized as a Webpack configuration file:

- `webpack.config.js`
- `webpack.config.ts`
- `webpack.config.mjs`
- `webpack.config.cjs`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/webpack Configuration

The `@nx/webpack/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/webpack/plugin",
      "options": {
        "buildTargetName": "build",
        "previewTargetName": "preview",
        "serveTargetName": "serve",
        "serveStaticTargetName": "serve-static"
      }
    }
  ]
}
```

The `buildTargetName`, `previewTargetName`, `serveTargetName` and `serveStaticTargetName` options control the names of the inferred Webpack tasks. The default names are `build`, `preview`, `serve` and `serve-static`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/webpack` package with your package manager.

```shell
npm add -D @nx/webpack
```

{% /tab %}
{% /tabs %}

## Generate a new project using Webpack

You can generate a [React](/nx-api/react) application or a [Web](/nx-api/web) application that uses Webpack in an existing Nx workspace. The [`@nx/react:app`](/nx-api/react/generators/application), [`@nx/node:app`](/nx-api/node/generators/application) and [`@nx/web:app`](/nx-api/web/generators/application) generators accept the `bundler` option, where you can pass `webpack`. This will generate a new application configured to use Webpack, and it will also install all the necessary dependencies, including the `@nx/webpack` plugin.

To generate a React application using Webpack, run the following:

```bash
nx g @nx/react:app apps/my-app --bundler=webpack
```

To generate a Node application using Webpack, run the following:

```bash
nx g @nx/node:app apps/my-app --bundler=webpack
```

To generate a Web application using Webpack, run the following:

```bash
nx g @nx/web:app apps/my-app --bundler=webpack
```
