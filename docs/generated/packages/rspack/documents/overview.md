---
title: Overview of the Nx Rspack Plugin
description: The Nx Plugin for Rspack contains executors, generators, and utilities for managing Rspack projects in an Nx Workspace.
---

The Nx Plugin for Rspack contains executors, generators, and utilities for managing Rspack projects in an Nx Workspace.

## Setting Up @nx/rspack

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/rspack` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/rspack` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/rspack
```

This will install the correct version of `@nx/rspack`.

### How @nx/rspack Infers Tasks

The `@nx/rspack` plugin will create a task for any project that has a Rspack configuration file present. Any of the following files will be recognized as a Rspack configuration file:

- `rspack.config.js`
- `rspack.config.ts`
- `rspack.config.mjs`
- `rspack.config.mts`
- `rspack.config.cjs`
- `rspack.config.cts`

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/rspack Configuration

The `@nx/rspack/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/rspack/plugin",
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

The `buildTargetName`, `previewTargetName`, `serveTargetName` and `serveStaticTargetName` options control the names of the inferred Rspack tasks. The default names are `build`, `preview`, `serve` and `serve-static`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/rspack` package with your package manager.

```shell
npm add -D @nx/rspack
```

{% /tab %}
{% /tabs %}

## Using @nx/rspack

### Generate a new project using Rspack

You can generate a [React](/nx-api/react) application or library that uses Rspack. The [`@nx/react:app`](/nx-api/react/generators/application) and [`@nx/react:lib`](/nx-api/react/generators/library) generators accept the `bundler` option, where you can pass `rspack`. This will generate a new application configured to use Rspack, and it will also install all the necessary dependencies, including the `@nx/rspack` plugin.

To generate a React application using Rspack, run the following:

```bash
nx g @nx/react:app my-app --bundler=rspack
```

To generate a React library using Rspack, run the following:

```bash
nx g @nx/react:lib my-lib --bundler=rspack
```

### Modify an existing React project to use Rspack

You can use the `@nx/rspack:configuration` generator to change your React to use Rspack. This generator will modify your project's configuration to use Rspack, and it will also install all the necessary dependencies, including the `@nx/rspack` plugin.

You can read more about this generator on the [`@nx/rspack:configuration`](/nx-api/rspack/generators/configuration) generator page.
