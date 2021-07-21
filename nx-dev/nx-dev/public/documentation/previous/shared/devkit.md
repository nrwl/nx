# Nx Devkit

Nx is a pluggable build tool, so most of its functionality is provided by plugins. The Nx Devkit is the underlying technology used to customize Nx to support different technologies and your own custom use-cases.

Plugins have:

- **Generators**
  - Anytime you run `nx generate ...`, you invoke a generator.
  - Generators automate making changes to the file system.
  - They are used to create/update applications, libraries, components, etc..
- **Executors**
  - Anytime you run `nx run ...` (or `nx test`, `nx build`), you invoke an executor.
  - Executors define how to perform an action on a project.
  - They are used to build applications and libraries, test them, lint them, etc..

All of the core plugins are written using Nx Devkit, and you can use the same utilities to write your own generators and executors.

## Pay as You Go

As with most things in Nx, the core of Nx Devkit is very simple. It only uses language primitives and immutable objects (the tree being the only exception). See [Simplest Generator](/{{framework}}/core-concepts/nx-devkit#simplest-generator) and [Simplest Executor](/{{framework}}/core-concepts/nx-devkit#simplest-executor). Most of what you will see in this guide are extra affordances -- things that are optional to use, but we found very handy when building plugins.

## Generators

Generators automate making file changes. They can create new files, overwrite existing files, delete existing files, etc. For example, adding a new application often requires creating numerous files and updating configuration. Adding a new component may require adding a storybook configuration and a suite of e2e tests. Generators can automate all of these and help you focus on actually matters.

A generator has:

- a schema describing the inputs (i.e., flags, args, options)
- the implementation taking the inputs and making changes to the file system

Unlike many other tools Nx generators update the file system atomically at the end. This means that if an error occurs, the file system is not partially updated. It also means that you can preview the changes to the file system without actually modifying any files.

### Schema

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

### Implementation

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
    path.join('tools/generators', schema.name),
    options
  );

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  return () => {
    installPackagesTask(tree);
  };
}
```

The generator is an async function. You could create new projects and generate new files, but you could also update existing files and refactor things. It's recommended to limit all the side-effects to interacting with the tree and printing to the console. Sometimes generators perform other side affects (e.g., installing npm packages). Perform them in the function returned from the generator. Nx won't run the returned function in the dry run mode.

### Composing Generators

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

### Testing Generators

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

### Devkit Helper Functions

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
- `getWorkspaceLayout` -- Tells where new libs and should be generated.
- `offestFromRoot` -- Calculates an offset from the root of the workspace, which is useful for constructing relative URLs.
- `stripIndents` -- Strips indents form a multiline string.
- `normalizePath` -- Coverts an os specific path to a unix style path.
- `joinPathFragments` -- Normalize fragments and joins them with a /.
- `toJS` -- Coverts a TypeScript file to JavaScript. Useful for generators that support both.
- `visitNotIgnoredFiles` -- Utility to act on all files in a tree that are not ignored by git.
- `applyChangesToString`-- Applies a list of changes to a string's original value. This is useful when working with ASTs

Each of those have detailed API docs. Check the API for more information.

It's also important to stress that those are just utility functions. You can use them but you don't have to. You can instead write your own functions that take the tree and do whatever you want to do with it.

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

## Executors

Executors act on a project. Some examples including: building projects, testing projects, serving projects.

An executor consists of the following:

- a schema describing the inputs (i.e., flags, args, options).
- the implementation taking the inputs and acting on the project.

### Schema

A generator's schema describes the inputs--what you can pass into it. The schema is used to validate inputs, to parse args (e.g., covert strings into numbers), to set defaults, and to power the VSCode plugin. It is written with [JSON Schema](https://json-schema.org/).

```json
{
  "cli": "nx",
  "id": "Echo",
  "description": "echo given string",
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "description": "Message to echo"
    },
    "upperCase": {
      "type": "boolean",
      "description": "Covert to all upper case",
      "default": false
    }
  },
  "required": ["message"]
}
```

The schema above defines two fields: `message` and `upperCase`. The `message` field is a string, `upperCase` is a boolean. The schema support for executors and generators is identical. See the section on generators above for more information.

### Implementation

The implementation function takes two arguments (the options and the executor context) and returns a promise (or an async iterable) with the success property. The context params contains information about the workspace and the invoked target.

Most of the time executors return a promise.

```typescript
interface Schema {
  message: string;
  upperCase: boolean;
}

export default async function printAllCaps(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: true }> {
  if (options.upperCase) {
    console.log(options.message.toUpperCase());
  } else {
    console.log(options.message);
  }
  return { success: true };
}
```

But you can also return an async iterable that can yield several values.

```typescript
async function wait() {
  return new Promise((res) => {
    setTimeout(() => res(), 1000);
  });
}

export default async function* counter(opts: { to: number; result: boolean }) {
  for (let i = 0; i < opts.to; ++i) {
    console.log(i);
    yield { success: false };
    await wait();
  }
  yield { success: opts.result };
}
```

### Composing Executors

An executor is just a function, so you can import and invoke it directly, as follows:

```typescript
import printAllCaps from 'print-all-caps';

export default async function (
  options: Schema,
  context: ExecutorContext
): Promise<{ success: true }> {
  // do something before
  await printAllCaps({ message: 'All caps' });
  // do something after
}
```

This only works when you know what executor you want to invoke. Sometimes, however, you need to invoke a target. For instance, the e2e target is often configured like this:

```json
{
  "e2e": {
    "builder": "@nrwl/cypress:cypress",
    "options": {
      "cypressConfig": "apps/myapp-e2e/cypress.json",
      "tsConfig": "apps/myapp-e2e/tsconfig.e2e.json",
      "devServerTarget": "myapp:serve"
    }
  }
}
```

In this case we need to invoke the target configured in devSeverTarget. We can do it as follows:

```typescript
async function* startDevServer(
  opts: CypressExecutorOptions,
  context: ExecutorContext
) {
  const { project, target, configuration } = parseTargetString(
    opts.devServerTarget
  );
  for await (const output of await runExecutor<{
    success: boolean;
    baseUrl?: string;
  }>(
    { project, target, configuration },
    {
      watch: opts.watch,
    },
    context
  )) {
    if (!output.success && !opts.watch)
      throw new Error('Could not compile application files');
    yield opts.baseUrl || (output.baseUrl as string);
  }
}
```

The `runExecutor` utility will find the target in the configuration, find the executor, construct the options (as if you invoked it in the terminal) and invoke the executor. Note that `runExecutor` always returns an iterable instead of a promise.

### Devkit Helper Functions

- `logger` -- Wraps `console` to add some formatting.
- `getPackageManagerCommand` -- Returns commands for the package manager used in the workspace.
- `parseTargetString` -- Parses a target string into {project, target, configuration}.
- `readTargetOptions` -- Reads and combines options for a given target.
- `runExecutor` -- Constructs options and invokes an executor.

### Simplest Executor

```json
{
  "cli": "nx",
  "id": "CustomExecutor",
  "type": "object",
  "properties": {},
  "additionalProperties": true
}
```

```typescript
export default async function (opts) {
  console.log('options', opts);
}
```

## Using RxJS Observables

The Nx devkit only uses language primitives (promises and async iterables). It doesn't use RxJS observables, but you can use them and convert them to a `Promise` or an async iterable.

You can convert `Observables` to a `Promise` with `toPromise`.

```typescript
import { of } from 'rxjs';

export default async function (opts) {
  return of({ success: true }).toPromise();
}
```

You can use the [`rxjs-for-await`](https://www.npmjs.com/package/rxjs-for-await) library to convert an `Observable` into an async iterable.

```ts
import { of } from 'rxjs';
import { eachValueFrom } from 'rxjs-for-await-async';

export default async function (opts) {
  return eachValueFrom(of({ success: true }));
}
```

## Using Generators and Executors

There are three main ways to use generators and executors:

- Workspace generators. Learn more in [this guide](/{{framework}}/generators/workspace-generators)
- Workspace executors. Learn more in [this guide](/{{framework}}/executors/creating-custom-builders)
- Creating custom plugins. Learn more in [this guide](/{{framework}}/nx-plugin/overview)
