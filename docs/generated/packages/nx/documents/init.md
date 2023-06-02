---
title: 'init - CLI command'
description: 'Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up distributed caching. For more info, check https://nx.dev/recipes/adopting-nx.'
---

# init

Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up distributed caching. For more info, check https://nx.dev/recipes/adopting-nx.

## Usage

```shell
nx init
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### addE2e

Type: `boolean`

Default: `false`

Set up Cypress E2E tests in integrated workspaces. Only for CRA projects.

### force

Type: `boolean`

Default: `false`

Force the migration to continue and ignore custom webpack setup or uncommitted changes. Only for CRA projects.

### help

Type: `boolean`

Show help

### integrated

Type: `boolean`

Default: `false`

Migrate to an Nx integrated layout workspace. Only for Angular CLI workspaces and CRA projects.

### interactive

Type: `boolean`

Default: `true`

When false disables interactive input prompts for options.

### nxCloud

Type: `boolean`

Set up distributed caching with Nx Cloud.

### version

Type: `boolean`

Show version number

### vite

Type: `boolean`

Default: `true`

Use Vite as the bundler. Only for CRA projects.
