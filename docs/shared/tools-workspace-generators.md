# Workspace Schematics

Workspace schematics provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, or ensuring libraries are generated and structured in a certain way, schematics help you standardize these tasks in a consistent, and predictable manner. Nx provides tooling around creating, and running custom schematics from within your workspace. This guide shows you how to create, run, and customize workspace schematics within your Nx workspace.

## Creating a workspace schematic

Use the Nx CLI to generate the initial files needed for your workspace schematic.

```sh
nx generate @nrwl/workspace:workspace-schematic my-schematic
```

After the command is finished, the workspace schematic is created under the `tools/schematics` folder.

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   ├── schematics
│   |   └── my-schematic/
│   |   |    ├── index.ts
│   |   |    └── schema.json
├── nx.json
├── package.json
└── tsconfig.json
```

The `index.ts` provides an entry point to the schematic. The file contains the factory function for the schematic to return a Rule. A rule is an operation that is performed against your filesystem.
The `schema.json` provides a description of the schematic, available options, validation information, and default values.

The initial schematic entry point contains a rule to generate a library.

```ts
import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';

export default function (schema: any): Rule {
  return chain([
    externalSchematic('@nrwl/workspace', 'lib', {
      name: schema.name,
    }),
  ]);
}
```

The `chain` function takes a an array of rules and combines them into a single rule. You use this function to perform multiple operations against your workspace in a single schematic. The `externalSchematic` function allows you to call schematics provided from by an installed npm package.

In the schema.json file for your schematic, the `name` is provided as a default option.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-schematic",
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

The `$default` object is used to read arguments from the command-line that are passed to the schematic. The first argument passed to this schematic is used as the `name` property.

## Running a workspace schematic

To run a schematic, invoke the `nx workspace-schematic` command with the name of the schematic.

```sh
nx workspace-schematic my-schematic mylib
```

## Creating custom rules

Schematics provide an API for managing files within your workspace. You can use schematics to do things such as create, update, move, and delete files. Files with static or dynamic content can also be created.

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

```ts
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
nx workspace-schematic my-schematic mylib
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

## Customizing schematic options

### Adding a TypeScript schema

To create a TypeScript schema to use in your schematic function, define a TypeScript file next to your schema.json named schema.ts. Inside the schema.ts, define an interface to match the properties in your schema.json file, and whether they are required.

```ts
export interface SchematicOptions {
  name: string;
  type?: string;
}
```

Import the TypeScript schema into your schematic file and replace the any in your schematic function with the interface.

```ts
import { chain, externalSchematic, Rule } from '@angular-devkit/schematics';
import { SchematicOptions } from './schema';

export default function (schema: SchematicOptions): Rule {
  return chain([
    externalSchematic('@nrwl/workspace', 'lib', {
      name: `${schema.name}-${schema.type || ''}`,
      unitTestRunner: 'none',
    }),
  ]);
}
```

### Adding static options

Static options for a schematic don't prompt the user for input. To add a static option, define a key in the schema.json file with the option name, and define an object with its type, description, and optional default value.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-schematic",
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

If you run the schematic without providing a value for the type, it is not included in the generated name of the library.

### Adding dynamic prompts

Dynamic options can prompt the user to select from a list of options. To define a prompt, add an `x-prompt` property to the option object, set the type to list, and define an items array for the choices.

```json
{
  "$schema": "http://json-schema.org/schema",
  "id": "my-schematic",
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

Running the schematic without providing a value for the type will prompt the user to make a selection.

## Debugging Workspace schematics

### With Visual Studio Code

First of all make sure to enable the `debug.node.autoAttach` option. You can set it either in your workspace settings file inside `.vscode/settings.json` or your global `settings.json`. Simply add:

```json
{
  "debug.node.autoAttach": "on"
}
```

Alternatively press <kbd>Cmd</kbd>+<kbd>P</kbd> (or <kbd>Ctrl</kbd>+<kbd>P</kbd>) to open VSCode's command palette and type "Debug: Toggle Auto Attach".

Once you've activated the `autoAttach` option, set a breakpoint in VSCode and execute your schematic with the `--inspect-brk` flag:

```sh
node --inspect-brk ./node_modules/nx/bin/nx.js workspace-schematic my-schematic mylib --dry-run
```

You may want to use the `--dry-run` flag to not actually apply the changes to the file system.

![](/shared/vscode-schematics-debug.png)

## Workspace schematic utilities

The `@nrwl/workspace` package provides many utility functions that can be used in schematics to help with modifying files, reading and updating configuration files, and working with an Abstract Syntax Tree (AST).
