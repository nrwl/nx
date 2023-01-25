Nx plugins are npm packages that contain [generators](/plugin-features/use-code-generators) and [executors](/plugin-features/use-task-executors) to extend a Nx workspace.

At its core, a generator is a function that creates or modifies code and an executor is a function that processes code. Nx makes it easier to call those functions from the terminal or through the [Nx Console UI](/core-features/integrate-with-editors). And you can use helper utils in the [Nx Devkit](/packages/devkit) to help build your generator or executor.

> A list of plugins that is maintained by Nrwl is found in the [Nrwl/nx repo](https://github.com/nrwl/nx/tree/master/packages). \
> A list of custom plugins created by the community is found in the [Community](/community) section.
> Plugins are written using Nx Devkit. **Read [Nx Devkit](/packages/devkit/documents/nrwl_devkit) for more information.**

{% youtube
src="https://www.youtube.com/embed/fC1-4fAZDP4"
title="Nx Tutorial: Building Custom Plugins for Nx"
width="100%" /%}

> For a detailed video explaining the things covered here and more, check out [Creating and Publishing Your Own Nx Plugin](https://www.youtube.com/watch?v=vVT7Al01VZc).

## Generating a Plugin

To get started with building a Nx Plugin, run the following command:

```shell
npx create-nx-plugin my-org --pluginName my-plugin
```

This command creates a brand-new workspace, and sets up a pre-configured plugin with the specified name.

> Note, the command above will create a plugin with the package name set to `@my-org/my-plugin`. You can pass `--importPath` to provide a different package name.

> If you do not want to create a new workspace, install the `@nrwl/nx-plugin` dependency in an already existing workspace with npm or yarn. Then run `nx g @nrwl/nx-plugin:plugin [pluginName]`.

A new plugin is created with a default generator, executor, and e2e app.

## Generator

The created generator contains boilerplate that will do the following:

- Normalize a schema (the options that the generator accepts)
- Update the `project.json`
- Add the plugin's project to the `nx.json` file
- Add files to the disk using templates

There will be an exported default function that will be the main entry for the generator.

### Generator options

The `schema.d.ts` file contains all the options that the generator supports. By default, it includes `directory`, `tags`, and `name` as the options. If more options need to be added, please update this file and the `schema.json` file.

{% callout type="note" title="More details" %}
The `schema.d.ts` file is used for type checking inside the implementation file. It should match the properties in `schema.json`.
{% /callout %}

### Adding more generators

To add more generators to the plugin, run the following command:
`nx generate @nrwl/nx-plugin:generator [generatorName] --project=[pluginName]`.

This will scaffold out a new generator and update the necessary files to support it.

### Generator Testing

The generator spec file includes boilerplate to help get started with testing. This includes setting up an empty workspace.

These tests should ensure that files within the tree (created with `createTreeWithEmptyWorkspace`) are in the correct place, and contain the right content.

Full E2Es are supported (and recommended) and will run everything on the file system like a user would.

## Executor

The default executor is set up to just emit a console log. Some examples of what an executor can do are:

- Support different languages, (Java, Go, Python, C#)
- Compile new UI framework components
- Deploy an app on a CDN
- Publish to NPM
- and many more!

### Adding more executors

To add more executors to the plugin, run the following command:
`nx generate @nrwl/nx-plugin:executor [executor] --project=[pluginName]`.

This will scaffold out a new generator and update the necessary files to support it.

### Executor testing

The executor spec file contains boilerplate to run the default exported function from the executor.

These tests should make sure that the executor is executing and calling the functions that it relies on.

Full E2Es are supported (and recommended) and will run everything on the file system like a user would.

## Testing your plugin

One of the biggest benefits that the Nx Plugin package provides is support for E2E and unit testing.

When the E2E app runs, a temporary E2E directory is created in the root of the workspace. This directory is a blank Nx workspace, and will have the plugin's built package installed locally.

### E2E Testing file

When the plugin is generated, a test file is created in the `my-plugin-e2e` app. Inside this test file, there are already tests for making sure that the executor ran, checking if directories are created with the `--directory` option, and checking if tags are added to the project configuration.

We'll go over a few parts of a test file below:

```typescript
it('should create my-plugin', async (done) => {
  const plugin = uniq('my-plugin');
  ensureNxProject('@my-org/my-plugin', 'dist/packages/my-plugin');
  await runNxCommandAsync(`generate @my-org/my-plugin:myPlugin ${plugin}`);

  const result = await runNxCommandAsync(`build ${plugin}`);
  expect(result.stdout).toContain('Executor ran');

  done();
});
```

- The `uniq` function creates a random name with the prefix and a random number.
- The `ensureNxProject` is the function that will create the temporary directory. It takes two arguments, the plugin package name and the dist directory of when it's built.
- The `runNxCommandAsync` will execute a `nx` command in the E2E directory.

There are additional functions that the `@nrwl/nx-plugin/testing` package exports. Most of them are file utilities to manipulate and read files in the E2E directory.

## Including Assets

Sometimes you might want to include some assets with the plugin. This might be a image or some additional binaries.

To make sure that assets are copied to the dist folder, open the plugin's `project.json` file. Inside the `build` property, add additional assets. By default, all `.md` files in the root, all non-ts files in folders, and the `generators.json` and `executors.json` files are included.

```jsonc {% fileName="project.json" %}
"build": {
  "executor": "@nrwl/node:package",
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
        "glob": "generators.json",
        "output": "."
      },
      {
        "input": "./packages/my-plugin",
        "glob": "executors.json",
        "output": "."
      }
    ]
  }
}
```

## Using your Nx Plugin

To use your plugin, simply list it in `nx.json` or use its generators and executors as you would for any other plugin. This could look like `nx g @my-org/my-plugin:lib` for generators or `"executor": "@my-org/my-plugin:build"` for executors. It should be usable in all of the same ways as published plugins in your local workspace immediately after generating it. This includes setting it up as the default collection in `nx.json`, which would allow you to run `nx g lib` and hit your plugin's generator.

{% callout type="warning" title="string" %}

Nx uses the paths from tsconfig.base.json when running plugins locally, but uses the recommended tsconfig for node 16 for other compiler options. See https://github.com/tsconfig/bases/blob/main/bases/node16.json

{% /callout %}
