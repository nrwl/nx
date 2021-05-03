# Workspace Generators

Workspace generators provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, or ensuring libraries are generated and structured in a certain way, generators help you standardize these tasks in a consistent, and predictable manner. Nx provides tooling around creating, and running custom generators from within your workspace. This guide shows you how to create, run, and customize workspace generators within your Nx workspace.

## Creating a workspace generator

Use the Nx CLI to generate the initial files needed for your workspace generator.

```sh
nx generate @nrwl/workspace:workspace-generator my-generator
```

After the command is finished, the workspace generator is created under the `tools/generators` folder.

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   ├── generators
│   |   └── my-generator/
│   |   |    ├── index.ts
│   |   |    └── schema.json
├── nx.json
├── package.json
└── tsconfig.json
```

The `index.ts` provides an entry point to the generator. The file contains a function that is called to perform manipulations on a tree that represents the file system.
The `schema.json` provides a description of the generator, available options, validation information, and default values.

The initial generator function creates a library.

```typescript
import { Tree, formatFiles, installPackagesTask } from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/workspace';

export default async function (tree: Tree, schema: any) {
  await libraryGenerator(tree, { name: schema.name });
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

To invoke other generators, import the entry point function and run it against the tree tree. `async/await` can be used to make code with Promises read like procedural code. The generator function may return a callback function that is executed after changes to the file system have been applied.

In the schema.json file for your generator, the `name` is provided as a default option. The `cli` property is set to `nx` to signal that this is a generator that uses `@nrwl/devkit` and not `@angular-devkit`.

```json
{
  "cli": "nx",
  "id": "test",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    }
  },
  "required": ["name"]
}
```

The `$default` object is used to read arguments from the command-line that are passed to the generator. The first argument passed to this schematic is used as the `name` property.

## Running a workspace generator

To run a generator, invoke the `nx workspace-generator` command with the name of the generator.

```sh
nx workspace-generator my-generator mylib
```

## Running a workspace schematic created with @angular-devkit

Generators that are created using the `@angular-devkit` are called schematics. Workspace schematics that have been created with the `@angular-devkit` will omit the `"cli": "nx"` property in `schema.json`. Nx will recognize this and correctly run the schematic using the same command as an `@nrwl/devkit` generator.

```sh
nx workspace-generator my-schematic mylib
```

The command is also aliased to the previous `workspace-schematic` command, so this still works:

```sh
nx workspace-schematic my-schematic mylib
```

## Creating files with a generator

Generators provide an API for managing files within your workspace. You can use generators to do things such as create, update, move, and delete files. Files with static or dynamic content can also be created.

The generator below shows you how to generate a library, and then scaffold out additional files with the newly created library.

First, you define a folder to store your static or dynamic templates used to generated files. This is commonly done in a `files` folder.

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   ├── generators
│   |   └── my-generator/
│   |   |    └── files
│   |   |        └── NOTES.md
│   |   |    ├── index.ts
│   |   |    └── schema.json
├── nx.json
├── package.json
└── tsconfig.json
```

Next, update the `index.ts` file for the generator, and generate the new files.

```typescript
import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  joinPathFragments,
} from '@nrwl/devkit';
import { libraryGenerator, getProjectConfig } from '@nrwl/workspace';

export default async function (tree: Tree, schema: any) {
  await libraryGenerator(tree, { name: schema.name });
  const libraryRoot = getProjectConfig(tree, schema.name).root;
  generateFiles(
    tree, // the virtual file system
    joinPathFragments(__dirname, './files'), // path to the file templates
    libraryRoot, // destination path of the files
    schema // config object to replace variable in file templates
  );
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

The exported function first creates the library, then creates the additional files in the new library's folder.

Next, run the generator:

> Use the `-d` or `--dry-run` flag to see your changes without applying them.

```sh
nx workspace-generator my-generator mylib
```

The following information will be displayed.

```sh
CREATE libs/mylib/README.md
CREATE libs/mylib/.babelrc
CREATE libs/mylib/src/index.ts
CREATE libs/mylib/src/lib/mylib.spec.ts
CREATE libs/mylib/src/lib/mylib.ts
CREATE libs/mylib/tsconfig.json
CREATE libs/mylib/tsconfig.lib.json
UPDATE tsconfig.base.json
UPDATE workspace.json
UPDATE nx.json
CREATE libs/mylib/.eslintrc.json
CREATE libs/mylib/jest.config.js
CREATE libs/mylib/tsconfig.spec.json
UPDATE jest.config.js
CREATE libs/mylib/NOTES.md
```

## Customizing generator options

### Adding a TypeScript schema

To create a TypeScript schema to use in your generator function, define a TypeScript file next to your schema.json named `schema.ts`. Inside the `schema.ts`, define an interface to match the properties in your schema.json file, and whether they are required.

```typescript
export interface SchematicOptions {
  name: string;
  type?: string;
}
```

Import the TypeScript schema into your generator file and replace the any in your generator function with the interface.

```typescript
import { Tree, formatFiles, installPackagesTask } from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/workspace';

export default async function (tree: Tree, schema: SchematicOptions) {
  await libraryGenerator(tree, { name: `${schema.name}-${schema.type || ''}` });
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

### Adding static options

Static options for a generator don't prompt the user for input. To add a static option, define a key in the schema.json file with the option name, and define an object with its type, description, and optional default value.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    },
    "type": {
      "type": "string",
      "description": "Provide the library type, such as 'data-access' or 'state'"
    }
  },
  "required": ["name"]
}
```

If you run the generator without providing a value for the type, it is not included in the generated name of the library.

### Adding dynamic prompts

Dynamic options can prompt the user to select from a list of options. To define a prompt, add an `x-prompt` property to the option object, set the type to list, and define an items array for the choices.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-generator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Library name",
      "$default": {
        "$source": "argv",
        "index": 0
      }
    },
    "type": {
      "type": "string",
      "description": "Provide the library type",
      "x-prompt": {
        "message": "Which type of library would you like to generate?",
        "type": "list",
        "items": [
          {
            "value": "data-access",
            "label": "Data Access"
          },
          {
            "value": "feature",
            "label": "Feature"
          },
          {
            "value": "state",
            "label": "State Management"
          }
        ]
      }
    }
  },
  "required": ["name"]
}
```

Running the generator without providing a value for the type will prompt the user to make a selection.

## Debugging Workspace generators

### With Visual Studio Code

1. Open the Command Palette and choose `Debug: Create JavaScript Debug Terminal`.
   This will open a terminal with debugging enabled.
2. Set breakpoints in your code
3. Run `nx workspace-generator my-generator` in the debug terminal.

![](/shared/vscode-schematics-debug.png)

## Workspace Generator Utilities

The `@nrwl/devkit` package provides many utility functions that can be used in schematics to help with modifying files, reading and updating configuration files, and working with an Abstract Syntax Tree (AST).
