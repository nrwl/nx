{% callout type="check" title="Local Nx plugins" %}
In Nx 13.10, we introduced the ability to run generators from Nx plugins in the workspace they were created in.

By using a "local" plugin, you can set the plugin as your workspace's default collection and get several other affordances that are not provided to workspace generators. This is the preferred method for "workspace generators", and existing generators will eventually be transitioned to use a local plugin.

Check the [nx-plugin guide](/packages/nx-plugin) for information on creating a new plugin.
{% /callout %}

# Workspace Generators

Workspace generators provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, or ensuring libraries are generated and structured in a certain way, generators help you standardize these tasks in a consistent, and predictable manner.

Nx provides tooling around creating, and running custom generators from within your workspace. This guide shows you how to create, run, and customize workspace generators within your Nx workspace.

## Creating a workspace generator

Use the Nx CLI to generate the initial files needed for your workspace generator.

```bash
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
└── tsconfig.base.json
```

The `index.ts` provides an entry point to the generator. The file contains a function that is called to perform manipulations on a tree that represents the file system.
The `schema.json` provides a description of the generator, available options, validation information, and default values.

The initial generator function creates a library.

```typescript
import { Tree, formatFiles, installPackagesTask } from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/workspace/generators';

export default async function (tree: Tree, schema: any) {
  await libraryGenerator(tree, { name: schema.name });
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

To invoke other generators, import the entry point function and run it against the tree. `async/await` can be used to make code with Promises read like procedural code. The generator function may return a callback function that is executed after changes to the file system have been applied.

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

```bash
nx workspace-generator my-generator mylib
```

## Debugging Workspace generators

### With Visual Studio Code

1. Open the Command Palette and choose `Debug: Create JavaScript Debug Terminal`.
   This will open a terminal with debugging enabled.
2. Set breakpoints in your code
3. Run `nx workspace-generator my-generator` in the debug terminal.

![](/shared/vscode-schematics-debug.png)

## Workspace Generator Utilities

The `@nrwl/devkit` package provides many utility functions that can be used in schematics to help with modifying files, reading and updating configuration files, and working with an Abstract Syntax Tree (AST).
