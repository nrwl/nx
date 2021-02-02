# Devkit

Nx is a pluggable build tool, so most of its functionality is provided by plugins.

Plugins have:

- Generators, which are used to create/update applications, libraries, components, etc..
- Executors, which are used to build applications and libraries, test them, lint them, etc..

Any time you run `nx g ...`, you invoke a generator. Any time you run `nx run ...` (or `nx test`, `nx build`), you invoke an executor. All the core plugins are written using Nx Devkit. and you can use the same utilities to write your own generators and executors.

## Pay as You Go

As with most things in Nx, the core of Nx Devkit is very simple. It only uses language primitives and immutable objects (the host being the only exception). See "Simplest Generator" and "Simplest Executor". Most of what you will see in this guide are extra affordances--things that are optional to use, but we found very handy when building plugins.

## Generators

A generator consists of a schema and an implementation.

### Schema

The generator's schema describe the inputs--what you can pass into it.

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

The schema above defines two fields: `name` and `skipFormat`. The `name` field is a string, `skipFormat` is a boolean. The `x-prompt` property tell Nx to ask for the `name` value if one isn't given. The `skipFormat` field has the default value set to `false`. The schema language is rich and lets you use lists, enums, references, etc.. A few more examples:

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

The schema is used to validate inputs, to parse args (e.g., covert strings into numbers), to set defaults, and to power the VSCode plugin. Sometimes, however, you may not know the schema or may not care, in this case, you can set the following:

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

Because of `"additionalProperties": true` the generator above will accept any extra parameters you will pass. They, of course, won't be validated or transformed, but sometimes that's good enough.

If you want to learn more about the schema language, check out the core plugins at [https://github.com/nrwl/nx](https://github.com/nrwl/nx) for more examples.

### Implementation

The implementation function takes two arguments: the host and the options.

- The host is a implementation of a file tree that allows you to read/write files, list children, etc.. It's recommended to use the host instead of directly interacting with the file system. This enables the `--dry-run` mode, so users can try different set of options before actually invoking the generator.
- The options are the inputs to the generator.

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

export default async function (host: Tree, options: Schema) {
  generateFiles(
    host,
    path.join(__dirname, 'files'),
    path.join('tools/generators', schema.name),
    options
  );

  if (!schema.skipFormat) {
    await formatFiles(host);
  }

  return () => {
    installPackagesTask(host);
  };
}
```

The generator is an async function. You could create new projects and generate new files, but you could also update existing files and refactor things. It's recommended to limit all the side-effects to interacting with the host and printing to the console. Sometimes generators perform other side affects (e.g., installing npm packages). Perform them in the function returned from the generator. Nx won't run the returned function in the dry run mode.

### Composing Generators

A generator is just an async function, so there is nothing special needed to compose generators. For instance, the following creates two React libraries:

```typescript
import {
  Tree,
  generateFiles,
  formatFiles,
  installPackagesTask,
} from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/react';

export default async function (host: Tree, options: Schema) {
  const libSideEffects1 = libraryGenerator(host, { name: options.name1 });
  const libSideEffects2 = libraryGenerator(host, { name: options.name2 });
  await performGlobalOperationsOnTheHost(host);
  return () => {
    libSideEffects1();
    libSideEffects2();
  };
}
```

### Testing Generators

The Nx Devkit provides the `createTreeWithEmptyWorkspace` utility to create an empty host that can be used in tests. Other than that the tests simply invoke the generator and check the changes in the host.

```typescript
import { readProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import createLib from './lib';

describe('lib', () => {
  it('should create a lib', async () => {
    const host = createTreeWithEmptyWorkspace();
    // update host before invoking the generator
    await createLib(host, { name: 'lib' });

    expect(readProjectConfiguration(host, 'lib')).toBeDefined();
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

It's also important to stress that those are just utility functions. You can use them but you don't have to. You can instead write your own functions that take the host and do whatever you want to do with it.

## Simplest Generator

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
export default async function (host, opts) {
  console.log('options', opts);
}
```

## Executors

An executor consists of a schema and an implementation.

### Schema

The executor's schema describe the inputs--what you can pass into it.

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
      "description": "Covert to all upper case",
      "type": "boolean",
      "default": false
    }
  },
  "required": ["message"]
}
```

The schema above defines two fields: `message` and `allCaps`. The `message` field is a string, `upperCase` is a boolean. The schema support for executors and generators is identical, so see the section on generators above for more information.

### Implementation

The implementation function takes two arguments (the options and the target context) and returns a promise (or an async iterable) with the success property. The context params contains information about the workspace and the invoked target.

Most of the time executors return a promise.

```typescript
interface Schema {
  message: string;
  allCaps: boolean;
}

export default async function printAllCaps(
  options: Schema,
  context: ExecutorContext
): Promise<{ success: true }> {
  if (options.allCaps) {
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
  const [project, target, configuration] = opts.devServerTarget.split(':');
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

The `runExecutor` utility will find the target in the configuration, find the executor, construct the options (as if you invoked it in the terminal) and invoke the executor. Note that runExecutor always returns an iterable instead of a promise.

### Devkit Helper Functions

- logger -- Wraps `console` to add some formatting.
- getPackageManagerCommand -- Returns commands for the package manager used in the workspace.
- runExecutor -- Constructs options and invokes an executor.

## Simplest Executor

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

The Nx devkit only uses language primitives (promises and async iterables). It doesn't use RxJS observables, but you can use them. In this case, you either need to convert them to promise (using `toPromise`) or covert them to async iterables using `import { eachValueFrom } from 'rxjs-for-await'`.

## Using Generators and Executors

There are three main ways ot use generators and executors:

- Workspace generators. Learn more in [this guide](/{{framework}}/workspace/generators/workspace-generators)
- Workspace executors. Learn more in [this guide](/{{framework}}/workspace/executors/tools-workspace-builders)
- Creating custom plugins. Learn more in [this guide](/{{framework}}/plugins/nx-plugin/overview)
