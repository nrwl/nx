# Create a Local Plugin

To get started with building a local Nx Plugin, install the `@nx/plugin` package and generate a plugin:

```shell
nx g @nx/plugin:plugin my-plugin
```

This will create a `my-plugin` project that contains all your plugin code and `my-plugin-e2e` for e2e tests.

> If you want to create a new workspace for your plugin, run `npx create-nx-plugin my-plugin`. This command will create a new workspace with `my-plugin` and `e2e` projects set up for you.

## Generator

To create a new generator run:

```shell
nx generate @nx/plugin:generator my-generator --project=my-plugin
```

The new generator is located in `/src/generators/my-generator`. The `my-generator.ts` file contains the code that runs the generator. This generator creates a new project using a folder of template files.

For more information about this sample generator, read the [simple generator recipe](/plugins/recipes/local-generators).

### Generator options

The `schema.d.ts` file contains all the options that the generator supports. By default, it includes `directory`, `tags`, and `name` as the options. If more options need to be added, please update this file and the `schema.json` file.

{% callout type="note" title="More details" %}
The `schema.d.ts` file is used for type checking inside the implementation file. It should match the properties in `schema.json`.
{% /callout %}

### Generator Testing

The generator spec file includes boilerplate to help get started with testing. This includes setting up an empty workspace.

These tests should ensure that files within the tree (created with `createTreeWithEmptyWorkspace`) are in the correct place, and contain the right content.

Full E2Es are supported and will run everything on the file system like a user would.

## Executor

To create a new executor run:

```shell
nx generate @nx/plugin:executor my-executor --project=my-plugin
```

The new executor is located in `/src/executors/my-executor`. The `my-executor.ts` file contains the code that runs the executor. This executor emits a console log, but executors can compile code, deploy an app, publish to NPM and much more.

For more information about this sample executor, read the [simple executor recipe](/plugins/recipes/local-executors).

### Executor testing

The executor spec file contains boilerplate to run the default exported function from the executor.

These tests should make sure that the executor is executing and calling the functions that it relies on. Typically, unit tests are more useful for generators and e2e tests are more useful for executors.

## Testing your plugin

One of the biggest benefits that the Nx Plugin package provides is support for E2E and unit testing.

When the E2E app runs, a temporary E2E directory is created in the root of the workspace. This directory is a blank Nx workspace, and will have the plugin's built package installed locally.

### E2E Testing file

When the plugin is generated, a test file is created in the `my-plugin-e2e` app. Inside this test file, there is a disabled test that gives you a starting point for writing your own tests. To enable the test, change `xit` to `it`.

We'll go over a few parts of a test file below:

```typescript
beforeAll(() => {
  ensureNxProject('my-plugin', 'dist/./.');
});

xit('should be able to build generated projects', async () => {
  const name = 'proj';
  const generator = 'PLACEHOLDER';
  await runNxCommandAsync(`generate my-plugin:${generator} --name ${name}`);
  expect(() => runNxCommand('build ${proj}')).not.toThrow();
  expect(() => checkFilesExist(`dist/${name}/index.js`)).not.toThrow();
});
```

- The `ensureNxProject` is the function that will create the temporary directory. It takes two arguments, the plugin package name and the dist directory of when it's built.
- The `runNxCommandAsync` function will execute a `nx` command in the E2E directory.

There are additional functions that the `@nx/plugin/testing` package exports. Most of them are file utilities to manipulate and read files in the E2E directory.

## Using your Nx Plugin Locally

To use your plugin, simply list it in `nx.json` or use its generators and executors as you would for any other plugin. This could look like `nx g @my-org/my-plugin:lib` for generators or `"executor": "@my-org/my-plugin:build"` for executors. It should be usable in all of the same ways as published plugins in your local workspace immediately after generating it.
