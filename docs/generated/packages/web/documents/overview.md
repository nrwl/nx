---
title: Web Plugin for Nx
description: Learn how to use the @nx/web plugin to create and manage Web Component applications and libraries in your Nx workspace, including testing and building.
---

The Nx Plugin for Web Components contains generators for managing Web Component applications and libraries within an Nx workspace. It provides:

- Integration with libraries such as Jest, Cypress, and Storybook.
- Scaffolding for creating buildable libraries that can be published to npm.
- Utilities for automatic workspace refactoring.

## Setting Up @nx/web

### Generating a new Workspace

To create a new workspace with React, run `npx create-nx-workspace@latest --preset=web-components`.

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/web` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/web` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/web
```

This will install the correct version of `@nx/web`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/web` package with your package manager.

```shell
npm add -D @nx/web
```

{% /tab %}
{% /tabs %}

## Using the @nx/web Plugin

### Creating Applications

You can add a new application with the following:

```shell
nx g @nx/web:app apps/my-new-app
```

The application uses no framework and generates with web components. You can add any framework you want on top of the default setup.

To start the application in development mode, run `nx serve my-new-app`.

{% callout type="note" title="React" %}
If you are looking to add a React application, check out the [React plugin](/nx-api/react).
{% /callout %}

### Creating Libraries

To create a generic TypeScript library (i.e. non-framework specific), use the [`@nx/js`](/nx-api/js) plugin.

```shell
nx g @nx/js:lib libs/my-new-lib

# If you want the library to be publishable to npm
nx g @nx/js:lib libs/my-new-lib \
--publishable \
--importPath=@myorg/my-new-lib
```

## Using Web

### Testing Projects

You can run unit tests with:

```shell
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` with the name or your project. This command works for both applications and libraries.

You can also run E2E tests for applications:

```shell
nx e2e my-new-app-e2e
```

Replace `my-new-app-e2e` with the name or your project with `-e2e` appended.

### Building Projects

React applications can be build with:

```shell
nx build my-new-app
```

And if you generated a library with `--buildable`, then you can build a library as well:

```shell
nx build my-new-lib
```

The output is in the `dist` folder. You can customize the output folder by setting `outputPath` in the project's `project.json` file.

The application in `dist` is deployable, and you can try it out locally with:

```shell
npx http-server dist/apps/my-new-app
```

The library in `dist` is publishable to npm or a private registry.

## More Documentation

- [Using Cypress](/nx-api/cypress)
- [Using Jest](/nx-api/jest)
