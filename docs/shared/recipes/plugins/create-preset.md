## Preset

When you create a new nx workspace, you run the command: [`npx create-nx-workspace`](/packages/nx/documents/create-nx-workspace).
This command accepts a `--preset` option, for example: `npx create-nx-workspace --preset=react-standalone`.
This preset option is pointing to a special generator function (remember, a generator is a function that simplifies an entire code generation script into a single function) that Nx will call when this `npx create-nx-workspace` command is run, that will generate your initial workspace.

{% youtube
src="https://www.youtube.com/embed/yGUrF0-uqaU"
title="Develop a Nx Preset for your Nx Plugin"
width="100%" /%}

### Custom Preset

At its core a preset is a generator, which we can create inside of a plugin.

All first-party Nx presets are built into nx itself, but you can [create your own plugin](/plugins/intro/getting-started) and create a generator with the magic name: `preset`. Once you've [published your plugin](/plugins/tutorials/publish-plugin) on npm, you can now run. the create-nx-workspace command with the preset option set to the name of your published package.

For example, take

```shell
npx create-nx-workspace --preset=qwik-nx
```

This command will create a new Qwik preset based on the [published npm package: `qwik-nx`](https://www.npmjs.com/package/qwik-nx). If we check this package's source code, we can see that it has a [generator named `preset`](https://github.com/qwikifiers/qwik-nx/tree/main/packages/qwik-nx/src/generators/preset).

If you **don't** have an existing plugin you can create one by running

```shell
  npx create-nx-plugin my-org --pluginName my-plugin
```

To create our preset inside of our plugin we can run

```shell
  nx generate @nx/plugin:generator --name=preset --project=happynrwl
```

{% callout type="warning" title="Double check" %}
The word `preset` is required for the name of this generator
{% /callout %}

You should have a similar structure to this:

```text
happynrwl/
	├── e2e
	├── jest.config.js
	├── jest.preset.js
	├── nx.json
	├── package-lock.json
	├── package.json
	├── packages
	│   └── happynrwl
	│       ├── src
	│       │   ├── executors
	│       │   ├── generators
	│       │   │   ├── happynrwl
	│       │   │   └── preset 		// <------------- Here
	│       │   └── index.ts
	├── tools
	└── tsconfig.base.json
```

After the command is finished, the preset generator is created under the folder named **preset**.
The **generator.ts** provides an entry point to the generator. This file contains a function that is called to perform manipulations on a tree that represents the file system. The **schema.json** provides a description of the generator, available options, validation information, and default values.

Here is the sample generator function which you can customize to meet your needs.

```typescript
export default async function (tree: Tree, options: PresetGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);
  addProjectConfiguration(tree, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: 'application',
    sourceRoot: `${normalizedOptions.projectRoot}/src`,
    targets: {
      exec: {
        executor: 'nx:run-commands',
        options: {
          command: `node ${projectRoot}/src/index.js`,
        },
      },
    },
    tags: normalizedOptions.parsedTags,
  });
  addFiles(tree, normalizedOptions);
  await formatFiles(tree);
}
```

To get an in-depth guide on customizing/running or debugging your generator see [local generators](/plugins/recipes/local-generators).

#### Usage

Before you are able to use your newly created preset you must package and publish it to a registry.

After you have published your plugin to a registry you can now use your preset when creating a new workspace

```shell
npx create-nx-workspace my-workspace --preset=my-plugin-name
```
