The ESLint plugin contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.

## Setting Up ESLint

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/eslint` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/eslint` by running the following command:

{% tabs %}
{%tab label="npm"%}

```shell
npm i -D @nx/eslint
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add -D @nx/eslint
```

{% /tab %}
{%tab label="pnpm"%}

```shell
pnpm add -D @nx/eslint
```

{% /tab %}
{% /tabs %}

## Lint

You can lint an application or a library with the following command:

```shell
nx lint my-project
```

## Utils

- [convert-to-flat-config](/nx-api/eslint/generators/convert-to-flat-config) - Converts the workspace's [ESLint](https://eslint.org/) configs to the new [Flat Config](https://eslint.org/blog/2022/08/new-config-system-part-2)

## ESLint plugin

Read about our dedicated ESLint plugin - [eslint-plugin-nx](/nx-api/eslint-plugin/documents/overview).
