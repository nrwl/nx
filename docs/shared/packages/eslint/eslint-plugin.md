The `@nx/eslint-plugin` package is an ESLint plugin that contains a collection of recommended ESLint rule configurations which you can extend from in your own ESLint configs, as well as the following Nx-specific ESLint rules:

- [enforce-module-boundaries](#enforce-module-boundaries-rule)
- [dependency-checks](#dependency-checks-rule)

## Setting Up ESLint Plugin

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/eslint-plugin` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/eslint-plugin` by running the following commands if the package is not already installed:

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nx/eslint-plugin
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/eslint-plugin
```

{% /tab %}
{% /tabs %}

## Included plugins

The plugin contains the following rule configurations divided into sub-plugins.

### JavaScript

The `@nx/javascript` ESLint plugin contains best practices when using JavaScript.

### TypeScript

The `@nx/typescript` ESLint plugin contains best practices when using TypeSript.

### Angular

Contains configurations matching best practices when using Angular framework:

- `@nx/angular`
- `@nx/angular-template`

### React

Contains configurations matching best practices when using React framework:

- `@nx/react-base`
- `@nx/react-jsx`
- `@nx/react-typescript`

You can also use `@nx/react` which includes all three `@nx/react-*` plugins

### Enforce Module Boundaries rule

The `enforce-module-boundaries` ESLint rule enables you to define strict rules for accessing resources between different projects in the repository. Enforcing strict boundaries helps prevent unplanned cross-dependencies. Read more about it on a [dedicated page](/nx-api/eslint-plugin/documents/enforce-module-boundaries).

### Dependency Checks rule

The `@nx/dependency-checks` ESLint rule enables you to discover mismatches between dependencies specified in a project's `package.json` and the dependencies that your project actually depends on. Read more about it on a [dedicated page](/nx-api/eslint-plugin/documents/dependency-checks).
