---
title: Enforce Organizational Best Practices with a Local Plugin
description: Learn how to create a custom Nx plugin that encodes your organization's best practices into code generators for consistent project creation.
---

# Enforce Organizational Best Practices with a Local Plugin

Every repository has a unique set of conventions and best practices that developers need to learn in order to write code that integrates well with the rest of the code base. It is important to document those best practices, but developers don't always read the documentation and even if they have read the documentation, they don't consistently follow the documentation every time they perform a task. Nx allows you to encode these best practices in code generators that have been tailored to your specific repository.

In this tutorial, we will create a generator that helps enforce the follow best practices:

- Every project in this repository should use Vitest for unit tests.
- Every project in this repository should be tagged with a `scope:*` tag that is chosen from the list of available scopes.
- Projects should be placed in folders that match the scope that they are assigned.
- Vitest should clear mocks before running tests.

## Get Started

Let's first create a new workspace with the `create-nx-workspace` command:

```shell
npx create-nx-workspace myorg --preset=react-monorepo --ci=github
```

Then we , install the `@nx/plugin` package and generate a plugin:

```shell
npx nx add @nx/plugin
npx nx g @nx/plugin:plugin tools/recommended
```

This will create a `recommended` project that contains all your plugin code.

## Create a Customized Library Generator

To create a new generator run:

```shell
npx nx generate @nx/plugin:generator tools/recommended/src/generators/library
```

The new generator is located in `tools/recommended/src/generators/library`. The `generator.ts` file contains the code that runs the generator. We can delete the `files` directory since we won't be using it and update the `generator.ts` file with the following code:

```ts {% fileName="tools/recommended/src/generators/library/generator.ts" %}
import { Tree } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as reactLibraryGenerator } from '@nx/react';
import { LibraryGeneratorSchema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
) {
  const callbackAfterFilesUpdated = await reactLibraryGenerator(tree, {
    ...options,
    linter: 'eslint',
    style: 'css',
    unitTestRunner: 'vitest',
  });

  return callbackAfterFilesUpdated;
}

export default libraryGenerator;
```

Notice how this generator is calling the `@nx/react` plugin's `library` generator with a predetermined list of options. This helps developers to always create projects with the recommended settings.

We're returning the `callbackAfterFilesUpdated` function because the `@nx/react:library` generator sometimes needs to install packages from NPM after the file system has been updated by the generator. You can provide your own callback function instead, if you have tasks that rely on actual files being present.

To try out the generator in dry-run mode, use the following command:

```shell
npx nx g @myorg/recommended:library test-library --dry-run
```

Remove the `--dry-run` flag to actually create a new project.

### Add Generator Options

The `schema.d.ts` file contains all the options that the generator supports. By default, it includes only a `name` option. Let's add a directory option to pass on to the `@nx/react` generator.

{% tabs %}
{% tab label="schema.d.ts" %}

```ts {% fileName="tools/recommended/src/generators/library/schema.d.ts" %}
export interface LibraryGeneratorSchema {
  name: string;
  directory?: string;
}
```

{% /tab %}
{% tab label="schema.json" %}

```json {% fileName="tools/recommended/src/generators/library/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "$id": "Library",
  "title": "",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "",
      "$default": {
        "$source": "argv",
        "index": 0
      },
      "x-prompt": "What name would you like to use?"
    },
    "directory": {
      "type": "string",
      "description": ""
    }
  },
  "required": ["name"]
}
```

{% /tab %}
{% /tabs %}

{% callout type="note" title="More details" %}
The `schema.d.ts` file is used for type checking inside the implementation file. It should match the properties in `schema.json`.
{% /callout %}

The schema files not only provide structure to the CLI, but also allow [Nx Console](/getting-started/editor-setup) to show an accurate UI for the generator.

![Nx Console UI for the library generator](/shared/plugins/generator-options-ui.png)

Notice how we made the `description` argument optional in both the JSON and type files. If we call the generator without passing a directory, the project will be created in a directory with same name as the project. We can test the changes to the generator with the following command:

```shell
npx nx g @myorg/recommended:library test-library --directory=nested/directory/test-library --dry-run
```

### Choose a Scope

It can be helpful to tag a library with a scope that matches the application it should be associated with. With these tags in place, you can [set up rules](/features/enforce-module-boundaries) for how projects can depend on each other. For our repository, let's say the scopes can be `store`, `api` or `shared` and the default directory structure should match the chosen scope. We can update the generator to encourage developers to maintain this structure.

{% tabs %}
{% tab label="schema.d.ts" %}

```ts {% fileName="tools/recommended/src/generators/library/schema.d.ts" %}
export interface LibraryGeneratorSchema {
  name: string;
  scope: string;
  directory?: string;
}
```

{% /tab %}
{% tab label="schema.json" %}

```json {% fileName="tools/recommended/src/generators/library/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "$id": "Library",
  "title": "",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "",
      "$default": {
        "$source": "argv",
        "index": 0
      },
      "x-prompt": "What name would you like to use?"
    },
    "scope": {
      "type": "string",
      "description": "The scope of your library.",
      "enum": ["api", "store", "shared"],
      "x-prompt": {
        "message": "What is the scope of this library?",
        "type": "list",
        "items": [
          {
            "value": "store",
            "label": "store"
          },
          {
            "value": "api",
            "label": "api"
          },
          {
            "value": "shared",
            "label": "shared"
          }
        ]
      }
    },
    "directory": {
      "type": "string",
      "description": ""
    }
  },
  "required": ["name"]
}
```

{% /tab %}
{% tab label="generator.ts" %}

```ts {% fileName="tools/recommended/src/generators/library/generator.ts" %}
import { Tree } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as reactLibraryGenerator } from '@nx/react';
import { LibraryGeneratorSchema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
) {
  const callbackAfterFilesUpdated = await reactLibraryGenerator(tree, {
    ...options,
    tags: `scope:${options.scope}`,
    directory: options.directory || `${options.scope}/${options.name}`,
    linter: 'eslint',
    style: 'css',
    unitTestRunner: 'vitest',
  });

  return callbackAfterFilesUpdated;
}

export default libraryGenerator;
```

{% /tab %}
{% /tabs %}

We can check that the scope logic is being applied correctly by running the generator again and specifying a scope.

```shell
npx nx g @myorg/recommended:library test-library --scope=shared --dry-run
```

This should create the `test-library` in the `shared` folder.

## Configure Tasks

You can also use your Nx plugin to configure how your tasks are run. Usually, organization focused plugins configure tasks by modifying the configuration files for each project. If you have developed your own tooling scripts for your organization, you may want to create an executor or infer tasks, but that process is covered in more detail in the tooling plugin tutorial.

Let's update our library generator to set the `clearMocks` property to `true` in the `vitest` configuration. First we'll run the `reactLibraryGenerator` and then we'll modify the created files.

```ts {% fileName="tools/recommended/src/generators/library/generator.ts" %}
import { formatFiles, Tree, runTasksInSerial } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as reactLibraryGenerator } from '@nx/react';
import { LibraryGeneratorSchema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
) {
  const directory = options.directory || `${options.scope}/${options.name}`;

  const tasks = [];
  tasks.push(
    await reactLibraryGenerator(tree, {
      ...options,
      tags: `scope:${options.scope}`,
      directory,
      linter: 'eslint',
      style: 'css',
      unitTestRunner: 'vitest',
    })
  );

  updateViteConfiguration(tree, directory);
  await formatFiles(tree);

  return runTasksInSerial(...tasks);
}

function updateViteConfiguration(tree, directory) {
  // Read the vite configuration file
  let viteConfiguration =
    tree.read(`${directory}/vite.config.ts`)?.toString() || '';

  // Modify the configuration
  // This is done with a naive search and replace, but could be done in a more robust way using AST nodes.
  viteConfiguration = viteConfiguration.replace(
    `globals: true,`,
    `globals: true,\n  clearMocks:true,`
  );

  // Write the modified configuration back to the file
  tree.write(`${directory}/vite.config.ts`, viteConfiguration);
}

export default libraryGenerator;
```

We updated the generator to use some new helper functions from the Nx devkit. Here are a few functions you may find useful. See the [full API reference](/reference/core-api/devkit/documents/nx_devkit) for all the options.

- [`runTasksInSerial`](/reference/core-api/devkit/documents/runTasksInSerial) - Allows you to collect many callbacks and return them all at the end of the generator.
- [`formatFiles`](/reference/core-api/devkit/documents/formatFiles) - Run Prettier on the repository
- [`readProjectConfiguration`](/reference/core-api/devkit/documents/readProjectConfiguration) - Get the calculated project configuration for a single project
- [`updateNxJson`](/reference/core-api/devkit/documents/updateNxJson) - Update the `nx.json` file

Now let's check to make sure that the `clearMocks` property is set correctly by the generator. First, we'll commit our changes so far. Then, we'll run the generator without the `--dry-run` flag so we can inspect the file contents.

```shell
git add .
git commit -am "library generator"
npx nx g @myorg/recommended:library store-test --scope=store
```

## Next Steps

Now that we have a working library generator, here are some more topics you may want to investigate.

- [Generate files](/extending-nx/recipes/creating-files) from EJS templates
- [Modify files](/extending-nx/recipes/modifying-files) with string replacement or AST transformations

## Encourage Adoption

Once you have a set of generators in place in your organization's plugin, the rest of the work is all communication. Let your developers know that the plugin is available and encourage them to use it. These are the most important points to communicate to your developers:

- Whenever there are multiple plugins that provide a generator with the same name, use the `recommended` version
- If there are repetitive or error prone processes that they identify, ask the plugin team to write a generator for that process

Now you can go through all the README files in the repository and replace any multiple step instructions with a single line calling a generator.
