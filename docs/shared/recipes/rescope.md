# Rescope Packages from @nrwl to @nx

As of version 16, all the official Nx plugins are moving from the `@nrwl` npm scope to `@nx`. The goal is for anyone looking through a list of dependencies to easily make the connection between the `nx` package and the `@nx` plugins that are associated with it.

## What Do You Need To Do?

For new repos, run `npx create-nx-workspace` as usual. The correct packages will be added.

For existing repos, run `nx migrate` as you normally would. When migrating to version 16 or higher, the package names will be automatically updated for you.

The packages are being renamed as defined in the tables below:

### Rename

These packages change names as well as changing scope from `@nrwl` to `@nx`.

| Nx 15 and lower        | Nx 16 and higher  |
| ---------------------- | ----------------- |
| @nrwl/eslint-plugin-nx | @nx/eslint-plugin |
| @nrwl/nx-devkit        | @nx/devkit        |
| @nrwl/nx-plugin        | @nx/plugin        |

### Rescope Only

All other packages keep the same name, but change scope from `@nrwl` to `@nx`.

| Nx 15 and lower    | Nx 16 and higher |
| ------------------ | ---------------- |
| @nrwl/angular      | @nx/angular      |
| @nrwl/cypress      | @nx/cypress      |
| @nrwl/detox        | @nx/detox        |
| @nrwl/esbuild      | @nx/esbuild      |
| @nrwl/expo         | @nx/expo         |
| @nrwl/express      | @nx/express      |
| @nrwl/jest         | @nx/jest         |
| @nrwl/js           | @nx/js           |
| @nrwl/linter       | @nx/linter       |
| @nrwl/nest         | @nx/nest         |
| @nrwl/next         | @nx/next         |
| @nrwl/node         | @nx/node         |
| @nrwl/react        | @nx/react        |
| @nrwl/react-native | @nx/react-native |
| @nrwl/rollup       | @nx/rollup       |
| @nrwl/storybook    | @nx/storybook    |
| @nrwl/vite         | @nx/vite         |
| @nrwl/web          | @nx/web          |
| @nrwl/webpack      | @nx/webpack      |
| @nrwl/workspace    | @nx/workspace    |

## @nrwl Scope End of Life

Starting in version 18, the `@nrwl` scoped packages will no longer be published to npm. Only the `@nx` scoped packages will be available on the npm registry.
