---
title: Pruning Projects for Deployment
description: Generate a pruned package.json and lockfile so Docker installs only production dependencies. Replaces the deprecated generatePackageJson option in Nx 20+.
sidebar:
  label: Pruning for Deployment
filter: 'type:Guides'
---

When deploying Node.js applications to containers, you typically need only production dependencies, not your entire workspace `node_modules`.
Pruning generates a standalone `package.json`, a pruned lockfile, and copies any workspace libraries your app depends on.
The result is everything you need to run `npm ci` inside a Docker image with only the packages your application uses.

To bundle your app into a single file instead (no `node_modules` needed),
see [Bundling projects for deployment](/docs/technologies/node/guides/bundling-node-projects).

## When to prune instead of bundle

| Approach                                                          | Best for                                | Trade-off                                     |
| ----------------------------------------------------------------- | --------------------------------------- | --------------------------------------------- |
| [Bundling](/docs/technologies/node/guides/bundling-node-projects) | Serverless functions, simple APIs       | Single file output, no `node_modules` needed  |
| Pruning                                                           | Docker deployments, native dependencies | Keeps `node_modules` but only production deps |

Use pruning when:

- Your app has native dependencies (e.g. `bcrypt`, `sharp`) that can't be bundled
- You want Docker layer caching, where dependency layers rebuild only when `package.json` changes
- You consume workspace libraries as packages rather than bundling them

{% aside type="tip" %}
New Node applications include prune targets by default.
Pass `--docker` to also generate an example Dockerfile: `nx g @nx/node:app --docker`.
{% /aside %}

## How pruning works

Pruning uses four Nx targets that run in sequence:

1. `build` compiles your application (esbuild, webpack, tsc, etc.).
1. `prune-lockfile` (`@nx/js:prune-lockfile`) reads your project `package.json`, generates a minimal `package.json`, and creates a pruned lockfile containing only production dependencies.
1. `copy-workspace-modules` (`@nx/js:copy-workspace-modules`) copies workspace libraries referenced via `workspace:*` into a `workspace_modules/` directory and rewrites their dependency references to `file:` paths.
1. `prune` (`nx:noop`) depends on both `prune-lockfile` and `copy-workspace-modules`, giving you a single command to run.

After running `nx prune my-app`, the build output directory contains:

```text
apps/my-app/dist/
├── main.js                          # Compiled application
├── package.json                     # Pruned production dependencies
├── package-lock.json                # Pruned lockfile (or yarn.lock / pnpm-lock.yaml)
└── workspace_modules/               # Only present if you have workspace deps
    └── @my-org/
        └── my-lib/
            ├── package.json
            └── ...
```

## Set up prune targets

Add the following targets to your project's `package.json` or `project.json`:

{% tabs syncKey="config" %}

{% tabitem label="package.json" %}

```json
// apps/my-app/package.json
{
  "name": "@my-org/my-app",
  "nx": {
    "targets": {
      "prune-lockfile": {
        "dependsOn": ["build"],
        "cache": true,
        "executor": "@nx/js:prune-lockfile",
        "outputs": [
          "{workspaceRoot}/apps/my-app/dist/package.json",
          "{workspaceRoot}/apps/my-app/dist/package-lock.json"
        ],
        "options": {
          "buildTarget": "build"
        }
      },
      "copy-workspace-modules": {
        "dependsOn": ["build"],
        "cache": true,
        "outputs": ["{workspaceRoot}/apps/my-app/dist/workspace_modules"],
        "executor": "@nx/js:copy-workspace-modules",
        "options": {
          "buildTarget": "build"
        }
      },
      "prune": {
        "dependsOn": ["prune-lockfile", "copy-workspace-modules"],
        "executor": "nx:noop"
      }
    }
  }
}
```

{% /tabitem %}

{% tabitem label="project.json" %}

```json
// apps/my-app/project.json
{
  "name": "@my-org/my-app",
  "targets": {
    "prune-lockfile": {
      "dependsOn": ["build"],
      "cache": true,
      "executor": "@nx/js:prune-lockfile",
      "outputs": [
        "{workspaceRoot}/apps/my-app/dist/package.json",
        "{workspaceRoot}/apps/my-app/dist/package-lock.json"
      ],
      "options": {
        "buildTarget": "build"
      }
    },
    "copy-workspace-modules": {
      "dependsOn": ["build"],
      "cache": true,
      "outputs": ["{workspaceRoot}/apps/my-app/dist/workspace_modules"],
      "executor": "@nx/js:copy-workspace-modules",
      "options": {
        "buildTarget": "build"
      }
    },
    "prune": {
      "dependsOn": ["prune-lockfile", "copy-workspace-modules"],
      "executor": "nx:noop"
    }
  }
}
```

{% /tabitem %}

{% /tabs %}

Replace `package-lock.json` in the `outputs` array with `yarn.lock` or `pnpm-lock.yaml` if needed.

Then run:

```shell
nx prune my-app
```

Both `prune-lockfile` and `copy-workspace-modules` set `cache: true`,
so subsequent runs are instant when nothing changes.

## Use pruned output in Docker

The generated Dockerfile copies the build output and runs `npm install`:

```dockerfile
# apps/my-app/Dockerfile
FROM docker.io/node:lts-alpine

ENV HOST=0.0.0.0
ENV PORT=3000

WORKDIR /app

COPY dist .

# You can remove this install step if you build with `--bundle` option.
# The bundled output will include external dependencies.
RUN npm --omit=dev -f install

CMD ["node", "main.js"]
```

The `COPY dist .` line works because the Dockerfile lives inside the project directory (`apps/my-app/`),
and the build output goes to `apps/my-app/dist/`.
The pruned `package.json`, lockfile, and `workspace_modules/` are all inside `dist/`.

Build and run:

```shell
# Build the app and prune dependencies
nx prune my-app

# Build the Docker image
npx nx docker:build my-app

# Run the container
nx docker:run my-app -p 3000:3000
```

## Migrate from `generatePackageJson`

If you're upgrading to Nx 20+ with TS Solution Setup (the default for new workspaces),
the `generatePackageJson` option is no longer supported.
You'll see this error:

{% aside type="caution" title="Error: generatePackageJson not supported" %}
`Setting 'generatePackageJson: true' is not supported with the current TypeScript setup. Update the 'package.json' file at the project root as needed and unset the 'generatePackageJson' option.`
{% /aside %}

Follow these steps to migrate to the prune workflow:

### Step 1: Move dependencies to your project package.json

With TS Solution Setup, each project has its own `package.json`.
List all runtime dependencies there:

```json
// apps/my-app/package.json
{
  "name": "@my-org/my-app",
  "dependencies": {
    "express": "^4.18.0",
    "@my-org/shared-utils": "workspace:*"
  }
}
```

Use the `workspace:*` protocol for workspace libraries.

### Step 2: Remove `generatePackageJson` from your build configuration

{% tabs syncKey="bundler" %}

{% tabitem label="esbuild" %}

Remove `generatePackageJson` from your esbuild target options:

```json
// apps/my-app/package.json
{
  "nx": {
    "targets": {
      "build": {
        "executor": "@nx/esbuild:esbuild",
        "options": {
          "platform": "node",
          "outputPath": "dist/apps/my-app",
          "format": ["cjs"],
          "main": "apps/my-app/src/main.ts",
          "tsConfig": "apps/my-app/tsconfig.app.json"
        }
      }
    }
  }
}
```

{% /tabitem %}

{% tabitem label="Webpack" %}

Remove `generatePackageJson` from your webpack config:

```js
// apps/my-app/webpack.config.js
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/my-app'),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
    }),
  ],
};
```

{% /tabitem %}

{% tabitem label="Rollup / Vite" %}

Remove `generatePackageJson` from your rollup or vite build options.
With TS Solution Setup, the project `package.json` is used directly.

{% /tabitem %}

{% /tabs %}

### Step 3: Add prune targets

Add the `prune-lockfile`, `copy-workspace-modules`, and `prune` targets
to your project `package.json` as shown in the [set up prune targets](#set-up-prune-targets) section.

### Step 4: Update your Dockerfile

Replace references to the old generated `package.json` with the pruned output.
See the [use pruned output in Docker](#use-pruned-output-in-docker) section for a recommended Dockerfile structure.
