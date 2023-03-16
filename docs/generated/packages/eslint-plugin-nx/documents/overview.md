The `@nrwl/eslint-plugin-nx` package is an ESLint plugin that contains a collection of recommended ESLint rule configurations which you can extend from in your own ESLint configs, as well as an Nx-specific lint rule called [enforce-module-boundaries](#enforce-module-boundaries-rule).

## Setting Up ESLint Plugin

### Installation

In any Nx workspace, you can install `@nrwl/eslint-plugin-nx` by running the following commands if the package is not already installed:

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nrwl/eslint-plugin-nx
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nrwl/eslint-plugin-nx
```

{% /tab %}
{% /tabs %}

## Included plugins

The plugin contains the following rule configurations divided into sub-plugins.

### JavaScript

The `@nrwl/nx/javascript` ESLint plugin contains best practices when using JavaScript.

### TypeScript

The `@nrwl/nx/typescript` ESLint plugin contains best practices when using TypeSript.

### Angular

Contains configurations matching best practices when using Angular framework:

- `@nrwl/nx/angular`
- `@nrwl/nx/angular-template`

### React

Contains configurations matching best practices when using React framework:

- `@nrwl/nx/react-base`
- `@nrwl/nx/react-jsx`
- `@nrwl/nx/react-typescript`

You can also use `@nrwl/nx/react` which includes all three `@nrwl/nx/react-*` plugins

### Enforce Module Boundaries rule

The `enforce-module-boundaries` ESLint rule enables you to define strict rules for accessing resources between different projects in the repository. Enforcing strict boundaries helps keep prevent unplanned cross-dependencies. Read more about it on a [dedicated page](/packages/eslint-plugin-nx/documents/enforce-module-boundaries)
