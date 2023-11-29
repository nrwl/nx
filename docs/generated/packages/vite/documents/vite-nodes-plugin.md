---
title: Overview of the @nx/vite/plugin
description: The @nx/vite/plugin adds Vite targets/projects to the Nx project graph. This allows you to run Vite for projects that have a vite.config.ts file without creating a project.json file.
---

{% callout type="note" title="Still in beta" %}
This feature is still in beta. To use it you must have the `NX_PCV3` environment variable set to `"true"`.
{% /callout %}

## What is the @nx/vite/plugin?

The `@nx/vite/plugin` adds Vite targets/projects to the Nx project graph. This allows you to run Vite for projects that have a `vite.config.ts` file without creating a `project.json` file.

This is an effort to reduce duplicate code and configurations for your projects that use Vite.

## How it works

The `@nx/vite:init` generator (which is called through the `@nx/vite:configuration` generator, and the `@nx/react:app|lib`, `@nx/vue:app|lib` and `@nx/web:app|lib` generators) the following entry is added in the `plugins` array of your `nx.json`:

```json
...
plugins: [
  {
    "plugin": "@nx/vite/plugin",
    "options": {
      "buildTargetName": "build",
      "previewTargetName": "preview",
      "serveTargetName": "serve",
      "testTargetName": "test",
      "serveStaticTargetName": "static-serve",
    },
  },
  ...
]
```

This will create targets for `build`, `preview`, `test` and `serve` in your project graph, so that you can run `nx build my-app`, `nx test my-app` etc, without manually defining these targets in each of your projects' `project.json` files. This will work for every single project in your workspace that has a `vite.config.ts|js` file.

## How to configure

The plugin generates these targets with bare minimum (no extra) options configuration. Any options you need for your Vite app, you can add in your project's `vite.config.ts`.

If you want to add some universal options for all your `build` targets, for example, you can still do so in the [`targetDefaults`](/recipes/running-tasks/reduce-repetitive-configuration#reduce-configuration-with-targetdefaults).

You can edit the name of your targets if you want to use a different name. For example, you can have this configuration:

```json
...
plugins: [
  {
    "plugin": "@nx/vite/plugin",
    "options": {
      "buildTargetName": "build-core",
      "previewTargetName": "preview",
      "serveTargetName": "serve",
      "testTargetName": "test",
      "serveStaticTargetName": "static-serve",
    },
  },
  ...
]
```

and this will create `build-core`, `preview`, `test` and `serve` targets in your project graph. You can then call `nx build-core my-app` for all your projects that have a `vite.config.ts|js` file.
