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

{% callout type="check" title="Rescope from @nrwl to @nx" %}

For Nx version 16+, official Nx plugins use the `@nx` npm scope. For older versions of Nx, use the `@nrwl` npm scope.

[Read more about the rescope ≫](/recipes/other/rescope)

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

- [convert-tslint-to-eslint](/packages/angular/generators/convert-tslint-to-eslint) - Converts a project linter from [TSLint](https://palantir.github.io/tslint/) to [ESLint](https://eslint.org/)

## ESLint plugin

Read about our dedicated ESLint plugin - [eslint-plugin-nx](/packages/eslint-plugin/documents/overview).
