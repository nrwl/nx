The ESLint plugin contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.

## Setting Up ESLint

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/eslint` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/eslint` by running the following commands if `@nx/eslint` package is not installed:

```shell
npm i --save-dev @nx/eslint
```

```shell
yarn add --dev @nx/eslint
```

## Lint

You can lint an application or a library with the following command:

```shell
nx lint my-app
```

```shell
nx lint my-lib
```

## Utils

- [convert-to-flat-config](/nx-api/eslint/generators/convert-to-flat-config) - Converts the workspace's [ESLint](https://eslint.org/) configs to the new [Flat Config](https://eslint.org/blog/2022/08/new-config-system-part-2)

## ESLint plugin

Read about our dedicated ESLint plugin - [eslint-plugin-nx](/nx-api/eslint-plugin/documents/overview).
