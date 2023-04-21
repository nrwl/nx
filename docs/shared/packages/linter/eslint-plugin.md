The `@nx/eslint-plugin-nx` package is an ESLint plugin that contains a collection of recommended ESLint rule configurations which you can extend from in your own ESLint configs, as well as an Nx-specific lint rule called [enforce-module-boundaries](#enforce-module-boundaries-rule).

## Setting Up ESLint Plugin

### Installation

In any Nx workspace, you can install `@nx/eslint-plugin-nx` by running the following commands if the package is not already installed:

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nx/eslint-plugin-nx
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/eslint-plugin-nx
```

{% /tab %}
{% /tabs %}

{% callout type="check" title="Rescope from @nrwl to @nx" %}

For Nx version 16+, official Nx plugins use the `@nx` npm scope. For older versions of Nx, use the `@nrwl` npm scope.

[Read more about the rescope ≫](/recipes/other/rescope)

{% /callout %}

## Included plugins

The plugin contains the following rule configurations divided into sub-plugins.

### JavaScript

The `@nx/nx/javascript` ESLint plugin contains best practices when using JavaScript.

### TypeScript

The `@nx/nx/typescript` ESLint plugin contains best practices when using TypeSript.

### Angular

Contains configurations matching best practices when using Angular framework:

- `@nx/nx/angular`
- `@nx/nx/angular-template`

### React

Contains configurations matching best practices when using React framework:

- `@nx/nx/react-base`
- `@nx/nx/react-jsx`
- `@nx/nx/react-typescript`

You can also use `@nx/nx/react` which includes all three `@nx/nx/react-*` plugins

### Enforce Module Boundaries rule

The `enforce-module-boundaries` ESLint rule enables you to define strict rules for accessing resources between different projects in the repository. Enforcing strict boundaries helps keep prevent unplanned cross-dependencies. Read more about it on a [dedicated page](/packages/eslint-plugin/documents/enforce-module-boundaries)
