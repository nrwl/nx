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

## Creating custom rules with @angular-devkit

Generators provide an API for managing files within your workspace. You can use schematics to do things such as create, update, move, and delete files. Files with static or dynamic content can also be created.

The schematic below shows you how to generate a library, and then scaffold out additional files with the newly created library.

First, you define a folder to store your static or dynamic templates used to generated files. This is commonly done in a `files` folder.

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   ├── schematics
│   |   └── my-schematic/
│   |   |    └── files
│   |   |        └── NOTES.md
│   |   |    ├── index.ts
│   |   |    └── schema.json
├── nx.json
├── package.json
└── tsconfig.json
```

Next, update the `index.ts` file for the schematic, and create different rules for generating a library, and generating the new files. Both rules have access to the available options provided for the schematic.

```typescript
import {
  apply,
  chain,
  mergeWith,
  move,
  Rule,
  SchematicContext,
  Tree,
  url,
  externalSchematic,
} from '@angular-devkit/schematics';
import { getProjectConfig } from '@nrwl/workspace';

function generateLibrary(schema: any): Rule {
  return externalSchematic('@nrwl/workspace', 'lib', {
    name: schema.name,
  });
}

function generateFiles(schema: any): Rule {
  return (tree: Tree, context: SchematicContext) => {
    context.logger.info('adding NOTES.md to lib');

    const templateSource = apply(url('./files'), [
      move(getProjectConfig(tree, schema.name).root),
    ]);

    return chain([mergeWith(templateSource)])(tree, context);
  };
}

export default function (schema: any): Rule {
  return (tree: Tree, context: SchematicContext) => {
    return chain([generateLibrary(schema), generateFiles(schema)])(
      tree,
      context
    );
  };
}
```

The exported function calls the two rules, first creating the library, then creating the additional files in the new library's folder.

Next, run the schematic:

> Use the `-d` or `--dry-run` flag to see your changes without applying them.

```sh
nx workspace-generator my-schematic mylib
```

The following information will be displayed.

```sh
>  NX  Executing your local schematic: my-schematic

CREATE libs/mylib/tslint.json (48 bytes)
CREATE libs/mylib/README.md (164 bytes)
CREATE libs/mylib/tsconfig.json (123 bytes)
CREATE libs/mylib/tsconfig.lib.json (172 bytes)
CREATE libs/mylib/src/index.ts (29 bytes)
CREATE libs/mylib/src/lib/mylib.ts (0 bytes)
CREATE libs/mylib/tsconfig.spec.json (273 bytes)
CREATE libs/mylib/jest.config.js (234 bytes)
CREATE libs/mylib/NOTES.md (15 bytes)
UPDATE tsconfig.json (582 bytes)
UPDATE angular.json (4751 bytes)
UPDATE nx.json (438 bytes)
UPDATE package.json (1959 bytes)
```

## Customizing generator options

### Adding a TypeScript schema

To create a TypeScript schema to use in your generator function, define a TypeScript file next to your schema.json named schema.ts. Inside the schema.ts, define an interface to match the properties in your schema.json file, and whether they are required.

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
