# Linter Plugin

The Linter plugin contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.

## Setting Up Linter

### Installation

In any Nx workspace, you can install `@nrwl/linter` by running the following commands if `@nrwl/linter` package is not installed:

```bash
npm i --save-dev @nrwl/linter
```

```bash
yarn add --dev @nrwl/linter
```

## Lint

You can lint an application or a library with the following command:

```bash
nx lint my-app
```

```bash
nx lint my-lib
```

## Executors

- [eslint](/linter/eslint) - Lints applications/libraries using [ESLint](https://eslint.org/)
- [lint](/linter/lint) - [**DEPRECATED**] Lints applications/libraries using [TSLint](https://palantir.github.io/tslint/)

## Generator

- [workspace-rule](/linter/workspace-rule) - Generates a new workspace [ESLint](https://eslint.org/) rule

## Plugin

- [eslint-plugin-nx](eslint-plugin-nx) - Plugin containing a collection of recommended ESLint rule configurations and an Nx specific [enforce-module-boundaries](eslint-plugin-nx#enforce-module-boundaries) rule

## Utils

- [convert-tslint-to-eslint](/angular/convert-tslint-to-eslint) - Converts a project linter from [TSLint](https://palantir.github.io/tslint/) to [ESLint](https://eslint.org/)
