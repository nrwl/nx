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

## Setting up a new Nx workspace with Vite

Here's an example on how to create a new React app with Vite

```shell
npx create-nx-workspace@latest --preset=react-standalone --bundler=vite
```

## Add Vite to an existing workspace

There are a number of ways to use Vite in your existing workspace.

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

### Initialize Vite

If you do not want to create any new projects or convert any existing projects yet, you can still use Nx to install all the necessary dependencies for Vite.js. This, for example, could be useful if you want to set up Vite.js manually for a project.

#### Install the `@nx/vite` plugin

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/vite` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

{% tabs %}
{% tab label="npm" %}

```shell
npm install -D @nx/vite
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/vite
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install -D @nx/vite
```

{% /tab %}
{% /tabs %}

#### Enable Inferred Tasks

{% callout type="note" title="Inferred Tasks" %}
In Nx version 17.3, the `@nx/vite` plugin can create [inferred tasks](/concepts/inferred-tasks) for projects that have a Vite configuration file present. This means you can run `nx build my-project`, `nx serve my-project`, `nx preview my-project`, `nx serve-static my-project` and `nx test my-project` for that project, even if there is no `build`, `serve`, `preview`, `serve-static` or `test` targets defined in `package.json` or `project.json`.
{% /callout %}

To enable inferred tasks, add `@nx/vite/plugin` to the `plugins` array in `nx.json`.

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

#### Task Inference Process

##### Identify Valid Projects

The `@nx/vite/plugin` plugin will create a target for any project that has a Vite configuration file present. Any of the following files will be recognized as a Vite configuration file:

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

##### Name the Inferred Task

Once a Vite configuration file has been identified, the targets are created with the name you specify under `buildTargetName`, `serveTargetName`, `previewTargetName`, `serveStaticTargetName` or `testTargetName` in the `nx.json` `plugins` array. The default names for the inferred targets are `build`, `serve`, `preview`, `serve-static` and `test`.

##### View and Edit Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project` in the command line. Nx Console also provides a quick way to override the settings of an inferred task.

#### Ask Nx to install the necessary dependencies

After you install the plugin, you can automatically initialize the project with Vite using an Nx generator:

```bash
nx g @nx/vite:init
```

{% callout type="note" title="Choosing a framework" %}
You will notice that the generator will ask you of the framework you are planning to use. This is just to make sure that the right dependencies are installed. You can always install manually any other dependencies you need.
{% /callout %}
