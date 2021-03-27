# Nx Plugins

Nx plugins are npm packages that contain schematics and builders to extend a Nx workspace. Schematics are blueprints to create new files from templates, and builders execute those files. These plugins also update the `nx.json` when generating new libs or apps.

> A list of plugins that is maintained by Nrwl is found in the [Nrwl/nx repo](https://github.com/nrwl/nx/tree/master/packages). \
> A list of custom plugins created by the community is found in the [Community](/nx-community) section.

<iframe width="560" height="315" src="https://www.youtube.com/embed/XYO689PAhow" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Generating a Plugin

To get started with building a Nx Plugin, run the following command:

```bash
npx create-nx-plugin my-org --pluginName my-plugin
```

This command creates a brand new workspace, and sets up a pre-configured plugin with the specified name.

## Workspace Structure

After executing the above command, the following tree structure is created:

```treeview
my-org/
├── e2e/
│   └── my-plugin-e2e/
│       ├── jest.config.js
│       ├── tests/
│       │   └── my-plugin.test.ts
│       ├── tsconfig.json
│       └── tsconfig.spec.json
├── packages/
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
├── tools
│   ├── schematics/
│   └── tsconfig.tools.json
├── jest.config.js
├── nx.json
├── package.json
├── tsconfig.json
├── workspace.json
└── yarn.lock
```

> If you do not want to create a new workspace, install the `@nrwl/nx-plugin` dependency in an already existing workspace with npm or yarn. Then run `nx g @nrwl/nx-plugin:plugin [pluginName]`.

A new plugin is created with a default schematic, builder, and e2e app.

## Schematic

The generated schematic contains boilerplate that will do the following:

- Normalize a schema (the options that the schematic accepts)
- Update the `workspace.json` (or `angular.json` if the plugin is used in a Angular CLI workspace)
- Add the plugin's project to the `nx.json` file
- Add files to the disk using templates

To change the type of project the plugin generates, change the `projectType` const with the `ProjectType` enum. This ensures that generated projects with the plugin will go in to the correct workspace directory (`libs/` or `apps/`).

```typescript
const projectType = ProjectType.Library;
// OR
// const projectType = ProjectType.Application;
```

### Schematic options

The `schema.d.ts` file contains all the options that the schematic supports. By default, it includes `directory`, `tags`, and `name` as the options. If more options need to be added, please update this file and the `schema.json` file.

> Note: The `schema.d.ts` file is used for type checking inside the implementation file. It should match the properties in `schema.json`.

### Adding more schematics

To add more schematics to the plugin, create a new folder that contains a implementation file, a `schema.json` file, and a `schema.d.ts` file. After, edit the `collection.json` file and add the new schematic there.

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

For more information on how schematics work, see [angular.io/guide/schematics-authoring](https://angular.io/guide/schematics-authoring)

### Schematic Testing

The schematic spec file includes boilerplate to help get started with testing. This includes setting up a empty workspace, and the schematic test runner.

Full E2Es are supported (and recommended) and will run everything on the file system like a user would.

## Builder

The default builder is set up to just emit a console log. Some examples of what a builder can do are:

- Use the .NET core compiler (or something similar)
- Compile Stencil/Svelte/Vue components
- Deploy an app on a CDN
- Publish to NPM
- and many more!

### Adding more builders

Adding more builders to the plugin is exactly the same as adding more schematics. Create a new folder and add a implementation, `schema.json` and `schema.d.ts` files. Then edit the `builders.json` file in the root of the plugin project.

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

> Note: to use builders in any target (inside the `workspace.json` or `angular.json`), use the following syntax `@my-org/my-plugin:newBuilder`

For more information on how builders work, see [angular.io/guide/cli-builder](https://angular.io/guide/cli-builder)

### Builder testing

The builder spec file contains boilerplate to set up the `CoreSchemaRegistry`, `TestingArchitectHost` and adds the builder from a package.json.

There are some additional comments to help with these tests. For more information about testing builders, see [angular.io/guide/cli-builder#testing-a-builder](https://angular.io/guide/cli-builder#testing-a-builder).

Full E2Es are supported (and recommended) and will run everything on the file system like a user would.

## Testing your plugin

One of the biggest benefits that the Nx Plugin package provides is support for E2E testing.

When the E2E app runs, a temporary E2E directory is created in the root of the workspace. This directory is a blank Nx workspace, and will have the plugin's built package installed locally.

### E2E Testing file

When the plugin is generated, a test file is created in the `my-plugin-e2e` app. Inside this test file, there are already tests for making sure that the builder ran, checking if directories are created with the `--directory` option, and checking if tags are added to `nx.json`.

We'll go over a few parts of a test file below:

```typescript
it('should create my-plugin', async (done) => {
  const plugin = uniq('my-plugin');
  ensureNxProject('@my-org/my-plugin', 'dist/packages/my-plugin');
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

## Including Assets

Sometimes you might want to include some assets with the plugin. This might be a image or some additional binaries.

To make sure that assets are copied to the dist folder, open the `workspace.json` (or `angular.json`) file, and find the plugin's project. Inside the `build` property, add additional assets. By default, all `.md` files in the root, all non-ts files in folders, and the `collection.json` and `builders.json` files are included.

```json
"build": {
  "builder": "@nrwl/node:package",
  "options": {
    // shortened...
    "assets": [
      "packages/my-plugin/*.md",
      {
        "input": "./packages/my-plugin/src",
        "glob": "**/*.!(ts)",
        "output": "./src"
      },
      {
        "input": "./packages/my-plugin",
        "glob": "collection.json",
        "output": "."
      },
      {
        "input": "./packages/my-plugin",
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
1. `npm publish ./dist/package/my-plugin` and follow the prompts from npm.
1. That's it!

> Note: currently you will have to modify the `package.json` version by yourself or with a tool.

After that, you can then install your plugin like any other npm package,
`npm i -D @my-org/my-plugin` or `yarn add -D @my-org/my-plugin`.

### Listing your Nx Plugin

Nx provides a utility (`nx list`) that lists both core and community plugins. To submit your plugin, please follow the steps below:

- Fork the [Nx repo](https://github.com/nrwl/nx/fork) (if you haven't already)
- Update the [`community/approved-plugins.json` file](https://github.com/nrwl/nx/blob/master/community/approved-plugins.json) with a new entry for your plugin that includes name, url and description
- Use the following commit message template: `chore(core): nx plugin submission [PLUGIN_NAME]`
- push your changes, and run `yarn submit-plugin`

> The `yarn submit-plugin` command automatically opens the Github pull request process with the correct template.

We will then verify the plugin, offer suggestions or merge the pull request!
