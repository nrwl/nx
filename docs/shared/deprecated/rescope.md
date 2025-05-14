---
title: 'Rescoping Packages from @nrwl to @nx'
description: 'Learn about the transition of official Nx plugins from @nrwl to @nx npm scope, and how to update your dependencies accordingly.'
---

# Rescope Packages from @nrwl to @nx

As of version 16, all the official Nx plugins moved from the `@nrwl` npm scope to `@nx`. The goal is for anyone looking through a list of dependencies to easily make the connection between the `nx` package and the `@nx` plugins that are associated with it.

As of version 20, the `@nrwl` scoped packages will no longer be published to npm.

## What Do You Need To Do?

For new repos, run `npx create-nx-workspace` as usual. The correct packages will be added.

For existing repos, run `nx migrate` as you normally would. When migrating to version 16 or higher, the package names will be automatically updated for you. If you have a local script, update it to use `@nx/*` packages.

If you maintain a Nx plugin, please update it to use the `@nx/*` packages.

> If you come across Nrwl in blog posts, videos, or elsewhere, that content is likely referring to these packages. Depending on when the content was published, it is likely still relevant.

### Rename

The packages are being renamed as defined in the tables below:

The following packages were not simply rescoped `@nrwl` to `@nx`.

| Nx 15 and lower        | Nx 16 and higher  |
| ---------------------- | ----------------- |
| @nrwl/nx-cloud         | nx-cloud          |
| @nrwl/eslint-plugin-nx | @nx/eslint-plugin |
| @nrwl/nx-plugin        | @nx/plugin        |

| Nx 15 and lower | Nx 16      | Nx 17      |
| --------------- | ---------- | ---------- |
| @nrwl/linter    | @nx/linter | @nx/eslint |

### Rescope Only

All other packages keep the same name, but change scope from `@nrwl` to `@nx`.

| Nx 15 and lower    | Nx 16            |
| ------------------ | ---------------- |
| @nrwl/angular      | @nx/angular      |
| @nrwl/aws-lambda   | @nx/aws-lambda   |
| @nrwl/cypress      | @nx/cypress      |
| @nrwl/detox        | @nx/detox        |
| @nrwl/devkit       | @nx/devkit       |
| @nrwl/esbuild      | @nx/esbuild      |
| @nrwl/expo         | @nx/expo         |
| @nrwl/express      | @nx/express      |
| @nrwl/gatsby       | @nx/gatsby       |
| @nrwl/jest         | @nx/jest         |
| @nrwl/js           | @nx/js           |
| @nrwl/nest         | @nx/nest         |
| @nrwl/netlify      | @nx/netlify      |
| @nrwl/next         | @nx/next         |
| @nrwl/node         | @nx/node         |
| @nrwl/react        | @nx/react        |
| @nrwl/react-native | @nx/react-native |
| @nrwl/remix        | @nx/remix        |
| @nrwl/rollup       | @nx/rollup       |
| @nrwl/rspack       | @nx/rspack       |
| @nrwl/storybook    | @nx/storybook    |
| @nrwl/vite         | @nx/vite         |
| @nrwl/web          | @nx/web          |
| @nrwl/webpack      | @nx/webpack      |
| @nrwl/workspace    | @nx/workspace    |

## @nrwl Scope End of Life

Starting in version 20, the `@nrwl` scoped packages will no longer be published to npm. Only the `@nx` scoped packages will be available on the npm registry.
