---
title: 'Maintain TypeScript Monorepos'
description: 'Learn how Nx simplifies TypeScript monorepo maintenance by auto-configuring tools, managing project references, and enhancing tooling for better monorepo support.'
---

# Maintain TypeScript Monorepos

Keeping all the industry-standard tools involved in a large TypeScript monorepo correctly configured and working well together is a difficult task. And the more tools you add, the more opportunity there is for tools to conflict with each other in some way.

In addition to [generating default configuration files](/features/generate-code) and [automatically updating dependencies](/features/automate-updating-dependencies) to versions that we know work together, Nx makes managing all the tools in your monorepo easier in two ways:

- Rather than adding another tool that you have to configure, Nx configures itself to match the existing configuration of other tools.
- Nx also enhances certain tools to be more usable in a monorepo context.

## Auto-Configuration

Whenever possible, Nx will detect the existing configuration settings of other tools and update itself to match.

### Project Detection with Workspaces

If your repository is using package manager workspaces, Nx will use those settings to find all the [projects](/reference/project-configuration) in your repository. So you don't need to define a project for your package manager and separately identify the project for Nx. The `workspaces` configuration on the left allows Nx to detect the project graph on the right.

{% side-by-side align="top" %}

```json {% fileName="/package.json" %}
{
  "workspaces": ["apps/*", "packages/*"]
}
```

{% graph height="200px" title="Project View" %}

```json
{
  "composite": false,
  "projects": [
    {
      "name": "product-state",
      "type": "lib",
      "data": {
        "root": "packages/cart/product-state",
        "tags": ["scope:cart", "type:state"]
      }
    },
    {
      "name": "ui-buttons",
      "type": "lib",
      "data": {
        "root": "packages/ui/buttons",
        "tags": ["scope:shared", "type:ui"]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
        "root": "apps/cart",
        "tags": ["type:app", "scope:cart"]
      }
    }
  ],
  "dependencies": {
    "product-state": [],
    "ui-buttons": [],
    "cart": [
      { "source": "cart", "target": "product-state", "type": "static" },
      { "source": "cart", "target": "ui-buttons", "type": "static" }
    ]
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": [],
  "enableTooltips": false
}
```

{% /graph %}

{% /side-by-side %}

### Inferred Tasks with Tooling Plugins

Nx provides [plugins](/concepts/nx-plugins) for tools that run tasks, like Vite, TypeScript, Playwright or Jest. These plugins can automatically [infer the Nx-specific task configuration](/concepts/inferred-tasks) based on the tooling configuration files that already exist.

In the example below, because the `/apps/cart/vite.config.ts` file exists, Nx knows that the `cart` project can run a `build` task using Vite. If you expand the `build` task on the right, you can also see that Nx configured the output directory for the [cache](/features/cache-task-results) to match the `build.outDir` provided in the Vite configuration file.

With inferred tasks, you can keep your tooling configuration file as the one source of truth for that tool's configuration, instead of adding an extra layer of configuration on top.

{% side-by-side align="top" %}

```ts {% fileName="/apps/cart/vite.config.ts" %}
/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/cart',
  plugins: [react()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});
```

{% project-details %}

```json
{
  "project": {
    "name": "cart",
    "type": "app",
    "data": {
      "root": "apps/cart",
      "targets": {
        "build": {
          "options": {
            "cwd": "apps/cart",
            "command": "vite build"
          },
          "cache": true,
          "dependsOn": ["^build"],
          "inputs": [
            "production",
            "^production",
            {
              "externalDependencies": ["vite"]
            }
          ],
          "outputs": ["{projectRoot}/dist"],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["vite"]
          }
        }
      },
      "name": "cart",
      "$schema": "../../../node_modules/nx/schemas/project-schema.json",
      "sourceRoot": "apps/cart/src",
      "projectType": "application",
      "tags": [],
      "implicitDependencies": [],
      "metadata": {
        "technologies": ["react"]
      }
    }
  },
  "sourceMap": {
    "root": ["apps/cart/project.json", "nx/core/project-json"],
    "targets": ["apps/cart/project.json", "nx/core/project-json"],
    "targets.build": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.command": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.cache": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.dependsOn": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.inputs": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.outputs": ["apps/cart/vite.config.ts", "@nx/vite/plugin"],
    "targets.build.options.cwd": [
      "apps/cart/vite.config.ts",
      "@nx/vite/plugin"
    ],
    "name": ["apps/cart/project.json", "nx/core/project-json"],
    "$schema": ["apps/cart/project.json", "nx/core/project-json"],
    "sourceRoot": ["apps/cart/project.json", "nx/core/project-json"],
    "projectType": ["apps/cart/project.json", "nx/core/project-json"],
    "tags": ["apps/cart/project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

{% /side-by-side %}

## Enhance Tools for Monorepos

Nx does not just reduce its own configuration burden, it also improves the functionality of your existing tools so that they work better in a monorepo context.

### Keep TypeScript Project References in Sync

TypeScript provides a feature called [Project References](https://www.typescriptlang.org/docs/handbook/project-references.html) that allows the TypeScript compiler to build and typecheck each project independently. When each project is typechecked, the TypeScript compiler will output an intermediate `*.tsbuildinfo` file that can be used by other projects instead of re-typechecking all dependencies. This feature can provide [significant performance improvements](/concepts/typescript-project-linking#typescript-project-references-performance-benefits), particularly in a large monorepo.

The main downside of this feature is that you have to manually define each project's references (dependencies) in the appropriate `tsconfig.*.json` file. This process is tedious to set up and very difficult to maintain as the repository changes over time. Nx can help by using a [sync generator](/concepts/sync-generators) to automatically update the references defined in the `tsconfig.json` files based on the project graph it already knows about.

{% side-by-side align="top" %}

{% graph height="200px" title="Project View" %}

```json
{
  "composite": false,
  "projects": [
    {
      "name": "product-state",
      "type": "lib",
      "data": {
        "root": "packages/cart/product-state",
        "tags": ["scope:cart", "type:state"]
      }
    },
    {
      "name": "ui-buttons",
      "type": "lib",
      "data": {
        "root": "packages/ui/buttons",
        "tags": ["scope:shared", "type:ui"]
      }
    },
    {
      "name": "cart",
      "type": "app",
      "data": {
        "root": "apps/cart",
        "tags": ["type:app", "scope:cart"]
      }
    }
  ],
  "dependencies": {
    "product-state": [],
    "ui-buttons": [],
    "cart": [
      { "source": "cart", "target": "product-state", "type": "static" },
      { "source": "cart", "target": "ui-buttons", "type": "static" }
    ]
  },
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false,
  "exclude": [],
  "enableTooltips": false
}
```

{% /graph %}

```jsonc {% fileName="apps/cart/tsconfig.json" %}
{
  "extends": "../../tsconfig.base.json",
  "files": [], // intentionally empty
  "references": [
    // UPDATED BY NX SYNC
    // All project dependencies
    {
      "path": "../../packages/product-state"
    },
    {
      "path": "../../packages/ui/buttons"
    },
    // This project's other tsconfig.*.json files
    {
      "path": "./tsconfig.lib.json"
    },
    {
      "path": "./tsconfig.spec.json"
    }
  ]
}
```

{% /side-by-side %}

Later, if someone adds another dependency to the `cart` app and then runs the `build` task, Nx will detect that the project references are out of sync and ask if the references should be updated.

```text {% command="nx build cart" path="~/myorg" %}
 NX   The workspace is out of sync

[@nx/js:typescript-sync]: Some TypeScript configuration files are missing project references to the projects they depend on or contain outdated project references.

This will result in an error in CI.

? Would you like to sync the identified changes to get your workspace up to date? …
❯ Yes, sync the changes and run the tasks
  No, run the tasks without syncing the changes
```
