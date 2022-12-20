A plugin containing a collection of recommended ESLint rule configurations wrapped as ESLint plugins and an Nx specific [enforce-module-boundaries](#enforce-module-boundaries) rule.

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

## ESLint plugins

The plugin contains the following rule configurations divided into sub-plugins.

### JavaScript

The `@nrwl/nx/javascript` ESLint plugin contains best practices when using JavaScript.

### TypeScript

The `@nrwl/nx/typescript` ESLint plugin contains best practices when using TypeSript.

### Angular

Contains configurations matching best practices when using Angular framework:

- @nrwl/nx/angular
- @nrwl/nx/angular-template

### React

Contains configurations matching best practices when using React framework:

- @nrwl/nx/react-base
- @nrwl/nx/react-jsx
- @nrwl/nx/react-typescript

You can also use `@nrwl/nx/react` which includes all three `@nrwl/nx/react-*` plugins

## enforce-module-boundaries

The `@nrwl/nx/enforce-module-boundaries` ESLint rule enables you to define strict rules for accessing resources between different projects in the repository. By enforcing strict boundaries it helps keep prevent unplanned cross-dependencies.

### Usage

You can use `enforce-module-boundaries` rule by adding it to your ESLint rules configuration:

```jsonc
{
  // ... more ESLint config here
  "overrides": [
    {
      "files": ["*.ts", "*.tsx", "*.js", "*.jsx"],
      "rules": {
        "@nrwl/nx/enforce-module-boundaries": [
          "error",
          {
            // ...rule specific configuration
          }
        ]
      }
    }
    // ... more ESLint overrides here
  ]
}
```

Read more about proper usage of this rule:

- [Enforce Project Boundaries](/core-features/enforce-project-boundaries)
- [Ban Dependencies with Certain Tags](/recipes/other/ban-dependencies-with-tags)
- [Tag in Multiple Dimensions](/recipes/other/tag-multiple-dimensions)
- [Ban External Imports](/recipes/other/ban-external-imports)
- [Tags Allow List](/recipes/other/tags-allow-list)
- [Taming Code Organization with Module Boundaries in Nx](https://blog.nrwl.io/mastering-the-project-boundaries-in-nx-f095852f5bf4)
