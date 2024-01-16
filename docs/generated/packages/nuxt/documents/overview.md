---
title: Overview of the Nx Nuxt Plugin
description: The Nx Plugin for Nuxt contains generators for managing Nuxt applications within a Nx workspace. This page also explains how to configure Nuxt on your Nx workspace.
---

The Nx plugin for [Nuxt](https://nuxt.com/).

## Setting up a new Nx workspace with Nuxt

You can create a new workspace that uses Nuxt with one of the following commands:

- Generate a new monorepo with a Nuxt app

```shell
npx create-nx-workspace@latest --preset=nuxt
```

## Add Nuxt to an existing workspace

There are a number of ways to use Nuxt in your existing workspace.

### Install the `@nx/nuxt` plugin

{% tabs %}
{% tab label="npm" %}

```shell
npm install -D @nx/nuxt
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/nuxt
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install -D @nx/nuxt
```

{% /tab %}
{% /tabs %}

### Enable Inferred Tasks

{% callout type="note" title="Inferred Tasks" %}
In Nx version 17.3, the `@nx/nuxt` plugin can create [inferred tasks](/concepts/inferred-tasks) for projects that have a Nuxt configuration file present. This means you can run `nx build my-project`, `nx serve my-project` and `nx test my-project` for that project, even if there is no `build`, `serve` or `test` targets defined in `package.json` or `project.json`.
{% /callout %}

To enable inferred targets, add `@nx/nuxt/plugin` to the `plugins` array in `nx.json`.

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

### Task Inference Process

#### Identify Valid Projects

The `@nx/nuxt/plugin` plugin will create a target for any project that has a Nuxt configuration file present. Any of the following files will be recognized as a Nuxt configuration file:

- `nuxt.config.js`
- `nuxt.config.ts`
- `nuxt.config.mjs`
- `nuxt.config.mts`
- `nuxt.config.cjs`
- `nuxt.config.cts`

#### Name the Inferred Task

Once a Nuxt configuration file has been identified, the tasks are created with the name you specify under `buildTargetName`, `serveTargetName` or `testTargetName` in the `nx.json` `plugins` array. The default names for the inferred tasks are `build`, `serve` and `test`.

#### View and Edit Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project` in the command line. Nx Console also provides a quick way to override the settings of an inferred task.

### Generate a new Nuxt app

```shell
nx g @nx/nuxt:app my-app
```

### Deploy a Nuxt app

Once you are ready to deploy your Nuxt application, you have absolute freedom to choose any hosting provider that fits your needs.

We have detailed [how to deploy your Nuxt application to Vercel in a separate guide](/recipes/nuxt/deploy-nuxt-to-vercel).
