---
title: Overview of the Nx Nuxt Plugin
description: The Nx Plugin for Nuxt contains generators for managing Nuxt applications within a Nx workspace. This page also explains how to configure Nuxt on your Nx workspace.
---

The Nx plugin for [Nuxt](https://nuxt.com/).

## Setting up a new Nx workspace with @nx/nuxt

You can create a new workspace that uses Nuxt with one of the following commands:

- Generate a new monorepo with a Nuxt app

```shell
npx create-nx-workspace@latest --preset=nuxt
```

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/nuxt` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/nuxt` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/nuxt
```

This will install the correct version of `@nx/nuxt`.

### How @nx/nuxt Infers Tasks

The `@nx/nuxt` plugin will create a task for any project that has an Nuxt configuration file present. Any of the following files will be recognized as an Nuxt configuration file:

- `nuxt.config.js`
- `nuxt.config.ts`
- `nuxt.config.mjs`
- `nuxt.config.mts`
- `nuxt.config.cjs`
- `nuxt.config.cts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/nuxt Configuration

The `@nx/nuxt/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/nuxt/plugin",
      "options": {
        "buildTargetName": "build",
        "testTargetName": "test",
        "serveTargetName": "serve"
      }
    }
  ]
}
```

- The `buildTargetName`, `testTargetName` and `serveTargetName` options control the names of the inferred Nuxt tasks. The default names are `build`, `test` and `serve`.

## Using Nuxt

### Generate a new Nuxt app

```shell
nx g @nx/nuxt:app my-app
```

### Deploy a Nuxt app

Once you are ready to deploy your Nuxt application, you have absolute freedom to choose any hosting provider that fits your needs.

We have detailed [how to deploy your Nuxt application to Vercel in a separate guide](/recipes/nuxt/deploy-nuxt-to-vercel).
