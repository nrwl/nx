## Preset

A Preset is a customization option which you provide when creating a new workspace. TS, Node, React are some internal presets that Nx provides by default.

{% youtube
src="https://www.youtube.com/embed/yGUrF0-uqaU"
title="Develop a Nx Preset for your Nx Plugin"
width="100%" /%}

### Custom Preset

At its core a preset is a generator, which we can create inside of a plugin.
If you **don't** have an existing plugin you can create one by running

```shell
  npx create-nx-plugin my-org --pluginName my-plugin
```

To create our preset inside of our plugin we can run

```shell
  nx generate @nrwl/nx-plugin:generator --name=preset --project=happynrwl
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

To get an in-depth guide on customizing/running or debugging your generator see [local generators](/recipes/generators/local-generators).

#### Usage

Before you are able to use your newly created preset you must package and publish it to a registry.

After you have published your plugin to a registry you can now use your preset when creating a new workspace

```shell
npx create-nx-workspace my-workspace --preset=my-plugin-name
```
