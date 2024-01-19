The ESLint plugin contains executors, generator, plugin and utilities used for linting JavaScript/TypeScript projects within an Nx workspace.

## Setting Up ESLint

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/eslint` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/eslint` by running the following command:

```shell
nx add @nx/eslint
```

This command will install the correct version of `@nx/eslint` and optionally set up inferred tasks.

### Enable Inferred Tasks

{% callout type="note" title="Inferred Tasks" %}
In Nx version 17.3, the `@nx/eslint` plugin can create [inferred tasks](/concepts/inferred-tasks) for projects that have an ESLint configuration file present. This means you can run `nx lint my-project` for that project, even if there is no `lint` task defined in `package.json` or `project.json`.
{% /callout %}

To enable inferred tasks, run the `nx add @nx/eslint` command and it will add `@nx/eslint/plugin` to the `plugins` array in `nx.json`.

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

### Task Inference Process

#### Identify Valid Projects

The `@nx/eslint` plugin will create a task for any project that has an ESLint configuration file present. Any of the following files will be recognized as an ESLint configuration file:

- `.eslintrc`
- `.eslintrc.js`
- `.eslintrc.cjs`
- `.eslintrc.yaml`
- `.eslintrc.yml`
- `.eslintrc.json`
- `eslint.config.js`

ESLint tasks will also be inferred for any project that has an ESLint configuration file in a parent directory. So, if there is an ESLint configuration file in the root of the repository, every project will have an inferred ESLint task.

#### Name the Inferred Task

Once an ESLint configuration file has been identified, the task is created with the name you specify under `targetName` in the `nx.json` `plugins` array. The default name for inferred tasks is `lint`.

#### View and Edit Inferred Tasks

To view inferred tasks for a project, open the [project details view](/concepts/inferred-tasks) in Nx Console or run `nx show project my-project` in the command line. Nx Console also provides a quick way to override the settings of an inferred task.

## Lint

You can lint an application or a library with the following command:

```shell
nx lint my-project
```

## Utils

- [convert-to-flat-config](/nx-api/eslint/generators/convert-to-flat-config) - Converts the workspace's [ESLint](https://eslint.org/) configs to the new [Flat Config](https://eslint.org/blog/2022/08/new-config-system-part-2)

## ESLint plugin

Read about our dedicated ESLint plugin - [eslint-plugin-nx](/nx-api/eslint-plugin/documents/overview).
