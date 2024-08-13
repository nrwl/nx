# Enforce Organizational Best Practices with a Local Plugin

Every repository has a unique set of conventions and best practices that developers need to learn in order to write code that integrates well with the rest of the code base. It is important to document those best practices, but developers don't always read the documentation and even if they have read the documentation, they don't consistently follow the documentation every time they perform a task. Nx allows you to encode these best practices in code generators that have been tailored to your specific repository.

Here are some examples of best practices that you may want to enforce in your repository:

- Every project in this repository should use Jest for unit tests and Playwright for E2E tests.
- Every project in this repository should be tagged with a `scope:*` tag that is chosen from the list of available scopes.
- Every new route should be registered in the main application and be configured in the same way.

In this tutorial, we'll walk through creating a plugin that extends the existing `@nx/react` plugin's `library` generator to restrict the options for the generator to only the options that make sense for the organization and sets the tags based on the scope chosen for the library.

## Get Started

Let's first create a new workspace with the `create-nx-workspace` command:

```shell
npx create-nx-workspace myorg --preset=react-integrated --ci=github
```

Then we , install the `@nx/plugin` package and generate a plugin:

```shell
npx nx add @nx/plugin
npx nx g @nx/plugin:plugin recommended --directory=tools/recommended
```

This will create a `my-plugin` project that contains all your plugin code.

## Create a Domain Library Generator

To create a new generator run:

```shell
npx nx generate @nx/plugin:generator library --directory="tools/recommended/src/generators/library"
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
  await reactLibraryGenerator(tree, {
    ...options,
    projectNameAndRootFormat: 'as-provided',
    linter: Linter.EsLint,
    style: 'css',
    unitTestRunner: 'vitest',
  });
}

export default libraryGenerator;
```

Notice how this generator is calling the `@nx/react` plugin's `library` generator with a predetermined list of options. This helps developers to always create projects with the recommended settings.

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
  await reactLibraryGenerator(tree, {
    ...options,
    tags: `scope:${options.scope}`,
    directory: options.directory || `${options.scope}/${options.name}`,
    projectNameAndRootFormat: 'as-provided',
    linter: Linter.EsLint,
    style: 'css',
    unitTestRunner: 'vitest',
  });
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
import { formatFiles, Tree } from '@nx/devkit';
import { Linter } from '@nx/eslint';
import { libraryGenerator as reactLibraryGenerator } from '@nx/react';
import { LibraryGeneratorSchema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  options: LibraryGeneratorSchema
) {
  const directory = options.directory || `${options.scope}/${options.name}`;
  await reactLibraryGenerator(tree, {
    ...options,
    tags: `scope:${options.scope}`,
    directory,
    projectNameAndRootFormat: 'as-provided',
    linter: Linter.EsLint,
    style: 'css',
    unitTestRunner: 'vitest',
  });

  // Read the vite configuration file
  let viteConfiguration = tree.read(`${directory}/vite.config.ts`).toString();

  // Modify the configuration
  // This is done with a naive search and replace, but could be done in a more robust way using AST nodes.
  viteConfiguration = viteConfiguration.replace(
    `globals: true,`,
    `globals: true,\n  clearMocks:true,`
  );

  // Write the modified configuration back to the file
  tree.write(`${directory}/vite.config.ts`, viteConfiguration);

  await formatFiles(tree);
}

export default libraryGenerator;
```

Let's check to make sure that the `clearMocks` property is set correctly by the generator. First, we'll commit our changes so far. Then, we'll run the generator without the `--dry-run` flag so we can inspect the file contents.

```shell
git add .
git commit -am "library generator"
npx nx g @myorg/recommended:library store-test --scope=store
```

## Update Generators

As the repository grows, your recommended best practices will change as well. You can update your generator and any new projects will immediately be up to date, but the existing projects take a little more work to migrate to the latest recommendations. You could globally make a change, but typically, a single developer will not know enough about every application in order to be confident that the changes did not introduce problems. Instead, you can make a generator that can make the suggested updates on a per-project basis and then ask the developers for those applications to run the generator and double-check that their app still runs correctly.

Let's make a generator that changes the Vitest coverage provider from `v8` to `istanbul`.

```shell
npx nx generate @nx/plugin:generator vitest-coverage-istanbul --directory="tools/recommended/src/generators/vitest-coverage-istanbul"
```

Now let's update the generator code:

```ts {% fileName="tools/recommended/src/generators/vitest-coverage-istanbul/generator.ts" %}
import { formatFiles, readProjectConfiguration, Tree } from '@nx/devkit';
import { VitestCoverageIstanbulGeneratorSchema } from './schema';

export async function vitestCoverageIstanbulGenerator(
  tree: Tree,
  options: VitestCoverageIstanbulGeneratorSchema
) {
  const projectConfig = readProjectConfiguration(tree, options.name);
  if (!projectConfig) {
    throw new Error(`No project found with the name ${options.name}`);
  }

  let viteConfiguration =
    tree.read(`${projectConfig.root}/vite.config.ts`)?.toString() || '';
  viteConfiguration = viteConfiguration.replace(
    `provider: 'v8',`,
    `provider: 'istanbul',`
  );
  tree.write(`${projectConfig.root}/vite.config.ts`, viteConfiguration);

  await formatFiles(tree);
}

export default vitestCoverageIstanbulGenerator;
```

And we can update the schema file so that Nx Console will give a dropdown of available projects for the `name` option when running the generator in the UI:

```json {% fileName="tools/recommended/src/generators/vitest-coverage-istanbul/schema.json" %}
{
  "$schema": "https://json-schema.org/schema",
  "$id": "VitestCoverageIstanbul",
  "title": "",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "The project to be updated",
      "$default": {
        "$source": "projectName"
      }
    }
  },
  "required": ["name"]
}
```

Now we just need a developer on each team to run this generator and verify that everything still works.

## Encourage Adoption

Once you have a set of generators in place in your organization's plugin, the rest of the work is all communication. Let your developers know that the plugin is available and encourage them to use it. These are the most important points to communicate to your developers:

- Whenever there are multiple plugins that provide a generator with the same name, use the `@myorg/recommended` version
- If there are repetitive or error prone processes that they identify, ask the plugin team to write a generator for that process

Now you can go through all the README files in the repository and replace any multiple step instructions with a single line calling a generator.
