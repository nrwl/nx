# Creating a Nx Plugin

## Generating a Plugin

To get started with building a Nx Plugin, you can run the following command:

```bash
npx create-nx-plugin my-org --pluginName my-plugin
```

This command will create a brand new workspace, and set up a pre-configured plugin with the specified name.

## Workspace Structure

After executing the above command, the following tree structure will be created:

```treeview
my-org/
├── apps/
│   └── my-plugin-e2e/
│       ├── jest.config.js
│       ├── tests/
│       │   └── my-plugin.test.ts
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── jest.config.js
├── libs/
│   └── my-plugin/
│       ├── README.md
│       ├── builders.json
│       ├── collection.json
│       ├── jest.config.js
│       ├── package.json
│       ├── src/
│       │   ├── builders/
│       │   │   └── my-plugin/
│       │   │       ├── builder.spec.ts
│       │   │       ├── builder.ts
│       │   │       ├── schema.d.ts
│       │   │       └── schema.json
│       │   ├── index.ts
│       │   └── schematics/
│       │       └── my-plugin/
│       │           ├── files/
│       │           │   └── src/
│       │           │       └── index.ts.template
│       │           ├── schema.d.ts
│       │           ├── schema.json
│       │           ├── schematic.spec.ts
│       │           └── schematic.ts
│       ├── tsconfig.json
│       ├── tsconfig.lib.json
│       └── tsconfig.spec.json
├── nx.json
├── package.json
├── tools
│   ├── schematics/
│   └── tsconfig.tools.json
├── tsconfig.json
├── workspace.json
└── yarn.lock
```

> If you do not want to create a new workspace, you can install install the `@nrwl/nx-plugin` dependency in an already existing workspace with npm or yarn. Then run `nx g @nrwl/nx-plugin:plugin [pluginName]`.

Whenever a new plugin is created, it will include a default schematic, builder, and e2e app.

## Schematic

The generated schematic will contain boilerplate that will do the following:

- Normalize a schema (the options that the schematic will accept)
- Update the `workspace.json` (or `angular.json` if you would like your plugin be used in a Angular CLI workspace)
- Add the plugin's project to the `nx.json` file
- Add files to the disk using templates

To change the type of project the plugin will generate, you can change the `projectType` const with the `ProjectType` enum. This will ensure that generated projects with your plugin will go in to the correct workspace directory (`libs/` or `apps/`).

```typescript
const projectType = ProjectType.Library;
// OR
// const projectType = ProjectType.Application;
```

### Schematic options

There will be a generated `schema.d.ts` file that will contain all the options that the schematic supports. By default, we include `directory`, `tags`, and `name` as the options. If you need to add more, please update this file and the `schema.json` file.

> Note: The `schema.d.ts` file is used for type checking inside your implementation file. It should match the properties in `schema.json`.

### Adding more schematics

To add more schematics to your plugin, create a new folder that contains a implementation file, a `schema.json` file, and a `schema.d.ts` file. After, edit the `collection.json` file and add your new schematic there.

```json
{
  "$schema": "../../node_modules/@angular-devkit/schematics/collection-schema.json",
  "name": "my-plugin",
  "version": "0.0.1",
  "schematics": {
    "myPlugin": {
      "factory": "./src/schematics/my-plugin/schematic",
      "schema": "./src/schematics/my-plugin/schema.json",
      "description": "my-plugin schematic"
    },
    // new schematic
    "added-schematic": {
      "factory": "./src/schematics/added-schematic/schematic",
      "schema": "./src/schematics/added-schematic/schema.json",
      "description": "added-schematic schematic"
    }
  }
}
```

To read more about schematics and how they work, you can go to the documentation at [angular.io/guide/schematics-authoring](https://angular.io/guide/schematics-authoring)

### Schematic Testing

The schematic spec file will include boilerplate to help you get started with testing. This includes setting up a empty workspace, and the schematic test runner.

Full E2Es are supported (and recommended) and will run everything on the file system like a user would.

## Builder

The generated builder is set up to just emit output. It's up to you to decide what you would like to actually want the builder to do. Some examples of what a builder can do are:

- Use the .NET core compiler (or something similar)
- Compile Stencil/Svelte/Vue components
- Deploy an app on a CDN
- Publish to NPM
- and many more!

### Adding more builders

Adding more builders to your plugin is exactly the same as adding more schematics. Create a new folder then add a implementation, `schema.json` and `schema.d.ts` files. Then edit the `builders.json` file in the root of your plugin project.

```json
{
  "$schema": "../../node_modules/@angular-devkit/architect/src/builders-schema.json",
  "builders": {
    "build": {
      "implementation": "./src/builders/my-plugin/builder",
      "schema": "./src/builders/my-plugin/schema.json",
      "description": "my-plugin builder"
    },
    // new builder
    "newBuilder": {
      "implementation": "./src/builders/new-builder/builder",
      "schema": "./src/builders/new-builder/schema.json",
      "description": "new-builder builder"
    }
  }
}
```

> Note: to use your new builder in any target (inside the `workspace.json` or `angular.json`), you would use the following `@my-org/my-plugin:newBuilder`

To read more about builders and how they work, you can go to the documentation at [angular.io/guide/cli-builder](https://angular.io/guide/cli-builder)

### Builder testing

The builder spec file contains boilerplate to set up the `CoreSchemaRegistry`, `TestingArchitectHost` and adds the builder from a package.json.

There are some additional comments to help with these tests. To read more about testing builders, you can go to the [angular.io/guide/cli-builder#testing-a-builder](https://angular.io/guide/cli-builder#testing-a-builder) docs.

Full E2Es are supported (and recommended) and will run everything on the file system like a user would.

## E2Es

One of the biggest benefits that the Nx Plugin package provides is support for E2E testing your plugin.

When running a E2E, we create a temporary E2E directory in the root of your workspace. This temporary directory is a blank Nx workspace, and will have your plugin's built package installed locally.

### E2E Testing file

When a new plugin is generated, a test file will be created in the `my-plugin-e2e` app. Inside this test file, there is already tests for making sure that the builder ran, checking if directories are created with the `--directory` option, and checking if tags are added to `nx.json`.

We'll go over a few parts of a test file below:

```typescript
it('should create my-plugin', async done => {
  const plugin = uniq('my-plugin');
  ensureNxProject('@my-org/my-plugin', 'dist/libs/my-plugin');
  await runNxCommandAsync(`generate @my-org/my-plugin:myPlugin ${plugin}`);

  const result = await runNxCommandAsync(`build ${plugin}`);
  expect(result.stdout).toContain('Builder ran');

  done();
});
```

- The `uniq` function creates a random name with the prefix and a random number.
- The `ensureNxProject` is the function that will create the temporary directory. It takes two arguments, the plugin package name and the dist directory of when it's built.
- The `runNxCommandAsync` will execute a `nx` command in the E2E directory.

There are additional functions that the `@nrwl/nx-plugin/testing` package exports. Most of them are file utilities to manipulate and read files in the E2E directory.

## Assets

Sometimes you might want to include some assets with your plugin. This might be a image or some additional binaries.

To make sure that assets are copied to the dist folder, open the `workspace.json` (or `angular.json`) file, and find the plugin's project. Inside the `build` property, you can add additional assets. By default, we include all `.md` files in the root, all non-ts files in folders, and the `collection.json` and `builders.json` files.

```json
"build": {
  "builder": "@nrwl/node:package",
  "options": {
    // shortened...
    "assets": [
      "libs/my-plugin/*.md",
      {
        "input": "./libs/my-plugin/src",
        "glob": "**/*.!(ts)",
        "output": "./src"
      },
      {
        "input": "./libs/my-plugin",
        "glob": "collection.json",
        "output": "."
      },
      {
        "input": "./libs/my-plugin",
        "glob": "builders.json",
        "output": "."
      }
    ]
  }
}
```

## Publishing your Nx Plugin

To publish your plugin follow these steps:

1. Build your plugin with the command `nx run my-plugin:build`
1. `npm publish ./dist/libs/my-plugin` and follow the prompts from npm.
1. Thats it!

> Note: currently you will have to modify the `package.json` version by yourself or with a tool.

After that, you can then install your plugin like any other npm package,
`npm i -D @my-org/my-plugin`.

### Nx listing

If you would like your plugin to be included with the `nx list` command, open up an issue on the [Nrwl/nx repo](https://github.com/nrwl/nx/issues/new) and let's discuss!
