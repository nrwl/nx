The Linter plugin contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.

## Setting Up Linter

### Installation

In any Nx workspace, you can install `@nx/linter` by running the following commands if `@nx/linter` package is not installed:

```shell
npm i --save-dev @nx/linter
```

```shell
yarn add --dev @nx/linter
```

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/linter` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. Run `nx report` to see a list of installed plugins. Use [`nx migrate`](/core-features/automate-updating-dependencies) to update plugin versions.
{% /callout %}

## Lint

You can lint an application or a library with the following command:

```shell
nx lint my-app
```

```shell
nx lint my-lib
```

## Utils

- [convert-to-flat-config](/packages/linter/generators/convert-to-flat-config) - Converts the workspace's [ESLint](https://eslint.org/) configs to the new [Flat Config](https://eslint.org/blog/2022/08/new-config-system-part-2)
- **Deprecated** [convert-tslint-to-eslint](/packages/angular/generators/convert-tslint-to-eslint) - Converts a project linter from [TSLint](https://palantir.github.io/tslint/) to [ESLint](https://eslint.org/)

## ESLint plugin

Read about our dedicated ESLint plugin - [eslint-plugin-nx](/packages/eslint-plugin/documents/overview).
