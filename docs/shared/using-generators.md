# Using Generators

## Overview

Generators provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, ensuring libraries are generated and structured in a certain way, or updating your configuration files, generators help you standardize these tasks in a consistent, and predictable manner.

Generators can be written using `@nrwl/devkit` or `@angular-devkit`. Generators written with the `@angular-devkit` are called schematics. To read more about the concepts of `@angular-devkit` schematics, and building an example schematic, see the [Schematics Authoring Guide](https://angular.io/guide/schematics-authoring).

The [Workspace Generators](/{{framework}}/generators/workspace-generators) guide shows you how to create, run, and customize workspace generators within your Nx workspace.

## Types of generators

There are three main types of generators:

1. **Plugin Generators** are available when an Nx plugin has been installed in your workspace.
2. **Workspace Generators** are generators that you can create for your own workspace. [Workspace generators](/{{framework}}/generators/workspace-generators) allow you to codify the processes that are unique to your own organization.
3. **Update Generators** are invoked by Nx plugins when you [update Nx](/{{framework}}/core-concepts/updating-nx) to keep your config files in sync with the latest versions of third party tools.

## Invoking plugin generators

Generators allow you to create or modify your codebase in a simple and repeatable way. Generators are invoked using the [`nx generate`](/{{framework}}/cli/generate) command.

```bash
nx generate [plugin]:[generator-name] [options]
nx generate @nrwl/react:component mycmp --project=myapp
```

It is important to have a clean git working directory before invoking a generator so that you can easily revert changes and re-invoke the generator with different inputs.

### Simplest Generator

```json
{
  "cli": "nx",
  "id": "CustomGenerator",
  "description": "Create a custom generator",
  "type": "object",
  "properties": {},
  "additionalProperties": true
}
```

```typescript
export default async function (tree, opts) {
  console.log('options', opts);
}
```

### Defining a generator schema

A generator's schema describes the inputs--what you can pass into it. The schema is used to validate inputs, to parse args (e.g., covert strings into numbers), to set defaults, and to power the VSCode plugin. It is written with [JSON Schema](https://json-schema.org/).

#### Examples

```json
{
  "cli": "nx",
  "id": "CustomGenerator",
  "description": "Create a custom generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Generator name",
      "x-prompt": "What name would you like to use for the workspace generator?"
    },
    "skipFormat": {
      "description": "Skip formatting files",
      "type": "boolean",
      "alias": "sf",
      "default": false
    }
  },
  "required": ["name"]
}
```

The schema above defines two fields: `name` and `skipFormat`. The `name` field is a string, `skipFormat` is a boolean. The `x-prompt` property tells Nx to ask for the `name` value if one isn't given. The `skipFormat` field has the default value set to `false`. The schema language is rich and lets you use lists, enums, references, etc.. A few more examples:

```json
{
  "cli": "nx",
  "id": "CustomGenerator",
  "description": "Create a custom generator",
  "type": "object",
  "properties": {
    "stringOrBoolean": {
      "oneOf": [
        {
          "type": "string",
          "default": "mystring!"
        },
        {
          "type": "boolean"
        }
      ]
    },
    "innerObject": {
      "type": "object",
      "properties": {
        "key": {
          "type": "boolean"
        }
      }
    },
    "array": {
      "type": "array",
      "items": {
        "type": "number"
      }
    },
    "complexXPrompt": {
      "type": "string",
      "default": "css",
      "x-prompt": {
        "message": "Which stylesheet format would you like to use?",
        "type": "list",
        "items": [
          {
            "value": "css",
            "label": "CSS"
          },
          {
            "value": "scss",
            "label": "SASS(.scss)"
          },
          {
            "value": "styl",
            "label": "Stylus(.styl)"
          },
          {
            "value": "none",
            "label": "None"
          }
        ]
      }
    },
    "positionalArg": {
      "type": "string",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    },
    "currentProject": {
      "type": "string",
      "$default": {
        "$source": "projectName"
      }
    }
  }
}
```

Sometimes, you may not know the schema or may not care, in this case, you can set the following:

```json
{
  "cli": "nx",
  "id": "CustomGenerator",
  "description": "Create a custom generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    }
  },
  "required": ["name"],
  "additionalProperties": true
}
```

Because `"additionalProperties"` is `true`, the generator above will accept any extra parameters you pass. They, of course, won't be validated or transformed, but sometimes that's good enough.

If you want to learn more about the schema language, check out the core plugins at [https://github.com/nrwl/nx](https://github.com/nrwl/nx) for more examples.

### Implementing a generator

The implementation is a function that takes two arguments:

- `tree`: an implementation of the file system
  - It allows you to read/write files, list children, etc.
  - It's recommended to use the tree instead of directly interacting with the file system.
  - This enables the `--dry-run` mode so you can try different sets of options before actually making changes to the files.
- `options`
  - This is a combination of the options from `workspace.json`, command-line overrides, and schema defaults.
  - All the options are validated and transformed in accordance with the schema.
  - You normally don't have to validate anything in the implementation function because it won't be invoked unless the schema validation passes.

The implementation can return a callback which is invoked _after changes have been made to the file system_.

#### Examples

```typescript
import {
  Tree,
  generateFiles,
  formatFiles,
  installPackagesTask,
} from '@nrwl/devkit';

interface Schema {
  name: string;
  skipFormat: boolean;
}

export default async function (tree: Tree, options: Schema) {
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    path.join('tools/generators', options.name),
    options
  );

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}
```

The generator is an async function. You could create new projects and generate new files, but you could also update existing files and refactor things. It's recommended to limit all the side-effects to interacting with the tree and printing to the console. Sometimes generators perform other side-effects such as installing npm packages. Perform them in the function returned from the generator. Nx won't run the returned function in the dry run mode.

### Devkit helper functions

Nx provides helpers several functions for writing generators:

- `readProjectConfiguration` -- Read the project configuration stored in workspace.json and nx.json.
- `addProjectConfiguration` -- Add the project configuration stored in workspace.json and nx.json.
- `removeProjectConfiguration` -- Remove the project configuration stored in workspace.json and nx.json.
- `updateProjectConfiguration` -- Update the project configuration stored in workspace.json and nx.json.
- `readWorkspaceConfiguration` -- Read general workspace configuration such as the default project or cli settings.
- `updateWorkspaceConfiguration` -- Update general workspace configuration such as the default project or cli settings.
- `getProjects` -- Returns the list of projects.
- `generateFiles` -- Generate a folder of files based on provided templates.
- `formatFiles` -- Format all the created or updated files using Prettier.
- `readJson` -- Read a json file.
- `writeJson` -- Write a json file.
- `updateJson` -- Update a json file.
- `addDependenciesToPackageJson` -- Add dependencies and dev dependencies to package.json
- `installPackagesTask` -- Runs `npm install`/`yarn install`/`pnpm install` depending on what is used by the workspaces.
- `names` -- Util function to generate different strings based off the provided name.
- `getWorkspaceLayout` -- Tells where new libs and apps should be generated.
- `offestFromRoot` -- Calculates an offset from the root of the workspace, which is useful for constructing relative URLs.
- `stripIndents` -- Strips indents from a multiline string.
- `normalizePath` -- Coverts an os specific path to a unix style path.
- `joinPathFragments` -- Normalize fragments and joins them with a /.
- `toJS` -- Coverts a TypeScript file to JavaScript. Useful for generators that support both.
- `visitNotIgnoredFiles` -- Utility to act on all files in a tree that are not ignored by git.
- `applyChangesToString`-- Applies a list of changes to a string's original value. This is useful when working with ASTs

Each of those have detailed API docs. Check the [API Docs](/{{framework}}/nx-devkit/index#functions) for more information.

It's also important to stress that those are just utility functions. You can use them but you don't have to. You can instead write your own functions that take the tree and do whatever you want to do with it.

### Composing generators

Generators are just async functions so they can be easily composed together. For instance, to write a generator that generates two React libraries:

```typescript
import {
  Tree,
  generateFiles,
  formatFiles,
  installPackagesTask,
} from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/react';

export default async function (tree: Tree, options: Schema) {
  const libSideEffects1 = libraryGenerator(tree, { name: options.name1 });
  const libSideEffects2 = libraryGenerator(tree, { name: options.name2 });
  await performOperationsOnTheTree(tree);
  return () => {
    libSideEffects1();
    libSideEffects2();
  };
}
```

### Testing generators

The Nx Devkit provides the `createTreeWithEmptyWorkspace` utility to create a tree with an empty workspace that can be used in tests. Other than that, the tests simply invoke the generator and check the changes are made in the tree.

```typescript
import { readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import createLib from './lib';

describe('lib', () => {
  it('should create a lib', async () => {
    const tree = createTreeWithEmptyWorkspace();
    // update tree before invoking the generator
    await createLib(tree, { name: 'lib' });

    expect(readProjectConfiguration(tree, 'lib')).toBeDefined();
  });
});
```
