# Use Nx As Your Framework CLI

Nx makes it easy to provide executors so that devs using your framework don't have to create their own build and test scripts. You can also create generators that make it simple to add in the building basic blocks. With Nx 16, you can also make the initial set up process straight forward.

With a few simple commands, you can allow your users to run something like `npx create-my-plugin` and they'll have a workspace set up in the best way for your plugin.

## Generate the create-package

If you don't already have a plugin, see the [create a local plugin tutorial](/plugins/tutorials/create-plugin).

To make the create-package script, run this generator:

```bash
nx generate @nx/plugin:create-package create-package --project=my-plugin
```

This will set up `create-my-plugin` and `create-my-plugin-e2e` projects. It will also add a generator named `preset`.

```treeview
my-plugin/
├── create-my-plugin/
│   └── bin/
├── create-my-plugin-e2e/
├── src/
│   └── generators/
│       └── preset/
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

The `create-my-plugin` package will execute the `create-nx-workspace` command and then run the `preset` generator on the newly created workspace.

The `preset` generator is where you will manipulate the file system in whatever way you need to set up the new workspace.

## Publish create-my-plugin

Once you're happy with the `preset` generator, build and publish the `create-my-plugin` project:

```bash
nx build create-my-plugin
nx publish create-my-plugin --ver=1.0.0
```

## Use create-my-plugin

Now that the package has been published, you can run

```
npx create-my-plugin
```

And you'll have a new workspace set up by your `preset` generator.
