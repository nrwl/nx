# Devkit

Nx is a pluggable build tool, so most of its functionality is provided by plugins. The two things plugins have are:

- Generators, which are used to create new applications, libraries, components, etc..
- Executors, which are used to build applications and libraries, test them, lint them, etc..

Any time you run `nx g ...`, you invoke a generator. Any time you run `nx run ...` (or `nx test`, `nx build`), you invoke an executor.

Nx Devkit is a set of utilities you can use to write your own generators and executors.

## Generators

A generator consists of a schema and an implementation.

### Schema

The generator's schema describe the inputs--what you can pass into it.

```json
{
  "cli": "nx",
  "id": "SchematicsNxWorkspaceSchematic",
  "title": "Create a custom generator",
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
      "default": false
    }
  },
  "required": ["name"]
}
```

The schema above defines two fields: `name` and `skipFormat`. The `name` field is a string, `skipFormat` is a boolean. The `x-prompt` property tell Nx to ask for the `name` value if one isn't given. The `skipFormat` field has the default value set to `false`. The schema language is rich and lets you use lists, enums, references, etc.. See the plugins at [https://github.com/nrwl/nx](https://github.com/nrwl/nx) for more examples.

### Implementation

The implementation function takes two arguments: the host and the options.

- The host is a implementation of a file tree that allows you to read/write files, list children, etc.. It's recommended to use the host instead of directly interacting with the file system to make the dry-run mode work.
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

The generator is simply an async function. You could create new projects and generate new files there, but you could also update existing files, refactor things, etc.. It's recommended to limit all the side-effects to interacting with the host and printing to the console. Sometimes generators perform other side affects (e.g., installing npm packages). Perform them in the function returned from the generator. Nx won't run it in the dry run mode.

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

The devkit provides the `createTreeWithEmptyWorkspace` utility to create an empty host that can be used in tests.

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

- `readProjectConfiguration`
- `addProjectConfiguration`
- `updateProjectConfiguration`
- `generateFiles`
- `formatFiles`
- `readJson`
- `installPackagesTask`
- `names`
- `getWorkspaceLayout`
- `offestFromRoot`

All of them have API docs with examples. Check the API docs to find out more.

## Executors

An executor consists of a schema and an implementation.

### Schema

The executor's schema describe the inputs--what you can pass into it.

```json
{
  "cli": "nx",
  "id": "Echo",
  "title": "echo given string",
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

The schema above defines two fields: `message` and `allCaps`. The `message` field is a string, `upperCase` is a boolean. The schema language is rich and lets you use lists, enums, references, etc.. See the plugins at [https://github.com/nrwl/nx](https://github.com/nrwl/nx) for more examples.

### Implementation

The implementation function takes two arguments (the options and the target context) and returns an object with the success property.

```typescript
interface Schema {
  message: string;
  allCaps: boolean;
}

export default async function (
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

The context parameters contains information about the workspace and the invoked target.

## Learn More

- Learn more about using workspace generators in [this guide](/{{framework}}/workspace/generators/workspace-generators)
- Learn more about writing custom plugins in [this guide](/{{framework}}/plugins/nx-plugin/overview)
