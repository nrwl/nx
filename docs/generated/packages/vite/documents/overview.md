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

There is a number of ways to use Vite in your existing workspace.

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

#### Ask Nx to install the necessary dependencies

After you install the plugin, you can automatically initialize the project with Vite using an Nx generator:

```bash
nx g @nx/vite:init
```

{% callout type="note" title="Choosing a framework" %}
You will notice that the generator will ask you of the framework you are planning to use. This is just to make sure that the right dependencies are installed. You can always install manually any other dependencies you need.
{% /callout %}
