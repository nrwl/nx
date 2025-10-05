---
title: ESLint Plugin for Nx
description: Learn how to set up and use the @nx/eslint plugin to integrate ESLint with Nx, enabling caching and providing code generators for ESLint configuration.
---

# @nx/eslint

The ESLint plugin integrates [ESLint](https://eslint.org/) with Nx. It allows you to run ESLint through Nx with caching enabled. It also includes code generators to help you set up ESLint in your workspace.

## Setting Up @nx/eslint

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/eslint` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/eslint` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/eslint
```

This will install the correct version of `@nx/eslint`.

### How @nx/eslint Infers Tasks

The `@nx/eslint` plugin will create a task for any project that has an ESLint configuration file present and files to lint. Any of the following files will be recognized as an ESLint configuration file:

- `.eslintrc`
- `.eslintrc.js`
- `.eslintrc.mjs`
- `.eslintrc.cjs`
- `.eslintrc.yaml`
- `.eslintrc.yml`
- `.eslintrc.json`
- `eslint.config.js`
- `eslint.config.mjs`
- `eslint.config.cjs`

Because ESLint applies configuration files to all subdirectories, the `@nx/eslint` plugin will also infer tasks for projects in subdirectories. So, if there is an ESLint configuration file in the root of the repository, every project will have an inferred ESLint task.

Even if a project has an ESLint configuration file, it will only have an inferred ESLint task if there are files to lint. Otherwise, the task will not be created. Therefore, if you don't want an ESLint task to be inferred for a particular project, make sure the project files are properly excluded from ESLint.

### View Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project --web` in the command line.

### @nx/eslint Configuration

The `@nx/eslint/plugin` is configured in the `plugins` array in `nx.json`.

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    }
  ]
}
```

- The `targetName` option controls the name of the inferred ESLint tasks. The default name is `lint`.

## Lint

You can lint an application or a library with the following command:

```shell
nx lint my-project
```

## Utils

- [convert-to-flat-config](/technologies/eslint/api/generators/convert-to-flat-config) - Converts the workspace's [ESLint](https://eslint.org/) configs to the new [Flat Config](https://eslint.org/blog/2022/08/new-config-system-part-2)

## ESLint plugin

Read about our dedicated ESLint plugin - [eslint-plugin-nx](/technologies/eslint/eslint-plugin).
