---
title: Overview of the Nx Nuxt Plugin
description: The Nx Plugin for Nuxt contains generators for managing Nuxt applications within a Nx workspace. This page also explains how to configure Nuxt on your Nx workspace.
---

# @nx/nuxt

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
        "serveTargetName": "serve",
        "buildStaticTargetName": "build-static",
        "serveStaticTargetName": "serve-static"
      }
    }
  ]
}
```

The `buildTargetName`, `testTargetName` and `serveTargetName` options control the names of the inferred Nuxt tasks. The default names are `build`, `test` and `serve`.

The `buildStaticTargetName` and `serveStaticTargetName` options control the names of the inferred Nuxt static tasks. The default names are `build-static` and `serve-static`.

## Using Nuxt

### Generate a new Nuxt app

```shell
nx g @nx/nuxt:app apps/my-app
```

### Deploy a Nuxt app

Once you are ready to deploy your Nuxt application, you have absolute freedom to choose any hosting provider that fits your needs.

We have detailed [how to deploy your Nuxt application to Vercel in a separate guide](/technologies/vue/nuxt/recipes/deploy-nuxt-to-vercel).

### E2E testing

By default `nuxt` **does not** generate static HTML files when you run the `build` command. However, Nx provides a `build-static` target that you can use to generate static HTML files for your Nuxt application. Essentially, this target runs the `nuxt build --prerender` command to generate static HTML files.

To perform end-to-end (E2E) testing on static HTML files using a test runner like Cypress. When you create a Nuxt application, Nx automatically creates a `serve-static` target. This target is designed to serve the static HTML files produced by the `build-static` command.

This feature is particularly useful for testing in continuous integration (CI) pipelines, where resources may be constrained. Unlike the `serve` target, `serve-static` does not require a Nuxt's Nitro server to operate, making it more efficient and faster by eliminating background processes, such as file change monitoring.

To utilize the `serve-static` target for testing, run the following command:

```shell
nx serve-static my-nuxt-app-e2e
```

This command performs several actions:

1. It will build the Nuxt application and generate the static HTML files.
2. It will serve the static HTML files using a simple HTTP server.
3. It will run the Cypress tests against the served static HTML files.
