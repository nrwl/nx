<p style="text-align: center;">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-dark.svg">
    <img alt="Nx - Smart Monorepos · Fast CI" src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-light.svg" width="100%">
  </picture>
</p>

{{links}}

<hr>

# Nx: Smart Monorepos · Fast CI

Nx is a build system, optimized for monorepos, with plugins for popular frameworks and tools and advanced CI capabilities including caching and distribution.

This package is a [Rspack plugin for Nx](https://nx.dev/nx-api/rspack).

{{content}}

<p style="text-align: center;"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx.png" width="600" alt="Nx - Smart, Fast and Extensible Build System"></p>

<hr>

# Nx: Smart, Fast and Extensible Build System

Nx is a next generation build system with first class monorepo support and powerful integrations.

This package is a Rspack plugin for Nx.

## Getting Started

Use `--preset=@nx/rspack` when creating new workspace.

e.g.

```bash
npx create-nx-workspace@latest rspack-demo --preset=@nx/rspack
```

Now, you can go into the `rspack-demo` folder and start development.

```bash
cd rspack-demo
npm start
```

You can also run lint, test, and e2e scripts for the project.

```bash
npm run lint
npm run test
npm run e2e
```

## Existing workspaces

You can add Rspack to any existing Nx workspace.

First, install the plugin:

```bash
npm install --save-dev @nx/rspack
```

Then, r

**Note:** You must restart the server if you make any changes to your library.
