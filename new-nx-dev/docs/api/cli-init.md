---
title: nx init
description: 'Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.'
---

# `nx init`

Adds Nx to any type of workspace. It installs nx, creates an nx.json configuration file and optionally sets up remote caching. For more info, check https://nx.dev/recipes/adopting-nx.



## Usage

```bash
nx init [options]
```

## Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--addE2e` | boolean | Set up Cypress E2E tests in integrated workspaces. Only for CRA projects. | `false` |
| `--cacheable` | string | No description available |  |
| `--force` | boolean | Force the migration to continue and ignore custom webpack setup or uncommitted changes. Only for CRA projects. | `false` |
| `--integrated` | boolean | No description available | `false` |
| `--interactive` | boolean | When false disables interactive input prompts for options. | `true` |
| `--nxCloud` | boolean | No description available |  |
| `--useDotNxInstallation` | boolean | No description available | `false` |
| `--vite` | boolean | No description available | `true` |



