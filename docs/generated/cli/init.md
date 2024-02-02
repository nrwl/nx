---
title: 'init - CLI command'
description: 'Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.'
---

# init

Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.

## Usage

```shell
nx init
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Options

### help

Type: `boolean`

Show help

### interactive

Type: `boolean`

Default: `true`

When false disables interactive input prompts for options.

### nxCloud

Type: `boolean`

Set up distributed caching with Nx Cloud.

### useDotNxInstallation

Type: `boolean`

Default: `false`

Initialize an Nx workspace setup in the .nx directory of the current repository.

### version

Type: `boolean`

Show version number
