# Create Your Own Plugin

Nx is like the VSCode of build tools. The core of Nx enables project and task graph creation and analysis, orchestration and
execution of tasks, computation caching, and code generation. [Nx plugins](#nx-plugins) extend this functionality and are built on top of the underlying [Nx Devkit](#nx-devkit).

{% callout type="note" title="Plugins are optional" %}
Many organizations use Nx without any plugins. If you are mainly interested in making your workspace faster or enabling distributed task execution, then plugins aren't necessary.
{% /callout %}

{% cards %}
{% card title="Create a Nx Generator in 100 seconds" description="Learn how to setup a new local generator in less than 2 minutes" type="video" url="https://www.youtube.com/watch?v=ubgroK5T6cA" /%}
{% card title="Creating and Publishing Your Own Nx Plugin" description="Learn how to build your own Playwright" type="video" url="https://youtu.be/vVT7Al01VZc" /%}
{% /cards %}

## Nx plugins

Nx plugins contain [executors](/plugin-features/use-task-executors) and [generators](/plugin-features/use-code-generators) to extend the capabilities of an Nx workspace. They can be shared as npm packages or referenced directly within a single repo.

{% personas %}

{% persona type="browse" title="Browse Existing Plugins" url="/community#plugin-directory" %}

Browse through plugins built by Nx and the community.

- [Plugin Directory](/community#plugin-directory)

{% /persona %}

{% persona type="create" title="Build a Plugin" url="/packages/nx-plugin" %}

Build a plugin for use in your own repo or to share with others.

- [Build a plugin](/packages/nx-plugin)

{% /persona %}

{% persona type="share" title="Share Your Plugin" url="/recipes/advanced-plugins/share-your-plugin" %}

Publish your plugin to npm and keep your plugin users up to date with migration generators.

- [Share your plugin](/recipes/advanced-plugins/share-your-plugin)

{% /persona %}

{% persona type="extend" title="Extend Core Nx Functionality" url="/recipes/advanced-plugins/project-graph-plugins" %}

Extend the Nx graph logic to understand other languages and custom setups.

- [Extend Core Nx Functionality](/recipes/advanced-plugins/project-graph-plugins)

{% /persona %}

{% /personas %}

All the core plugins are written using [Nx Devkit](/packages/devkit), and you can use the same utilities to write your own generators and
executors.

{% callout type="check" title="Plugins!" %}
The Nx team maintains a core set of plugins for many application and tooling frameworks. You can write [generators](/recipes/generators/local-generators) and [executors](/recipes/executors/creating-custom-executors) in a plugin to use in your own repo or share it with the community. The [Nx Plugin](/packages/nx-plugin) plugin provides guidance on how you can build your own custom plugins.
{% /callout %}

### Pay as you go

As with most things in Nx, the core of Nx Devkit is very simple. It only uses language primitives and immutable
objects (the tree being the only exception). See [Simplest Generator](/recipes/generators/creating-files)
and [Simplest Executor](/plugin-features/use-task-executors#simplest-executor) for examples on creating generators
and executors. The [Using Executors](/plugin-features/use-task-executors)
and [Using Generators](/plugin-features/use-code-generators) guides also have additional information on executors
and generators.

## Learn more

- [Creating and Publishing Your Own Nx Plugin - Youtube](https://www.youtube.com/watch?v=vVT7Al01VZc)
- [Walkthrough Creating an Nx Plugin for tRPC](https://blog.nrwl.io/create-your-own-trpc-stack-de42209f83a3)
- [Local generators](/recipes/generators/local-generators)
- [Local executors](/recipes/executors/creating-custom-executors)
- [Nx Community Plugins](/community)
