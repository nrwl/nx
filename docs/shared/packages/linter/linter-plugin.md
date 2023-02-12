The Linter plugin contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.

## Setting Up Linter

### Installation

In any Nx workspace, you can install `@nrwl/linter` by running the following commands if `@nrwl/linter` package is not installed:

```shell
npm i --save-dev @nrwl/linter
```

```shell
yarn add --dev @nrwl/linter
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

- [convert-tslint-to-eslint](/packages/angular/generators/convert-tslint-to-eslint) - Converts a project linter from [TSLint](https://palantir.github.io/tslint/) to [ESLint](https://eslint.org/)
