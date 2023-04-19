# Plugin Use Cases

Nx plugins contain [generators](/plugin-features/use-code-generators) and [executors](/plugin-features/use-task-executors) that extend the capabilities of an Nx workspace. They can be shared as npm packages or referenced locally within the same repo.

{% cards cols="2" %}

{% title-card title="Use a Plugin" url="#use-a-plugin" /%}
{% title-card title="Create a Local Plugin" url="#create-a-local-plugin" /%}
{% title-card title="Maintain a Published Plugin" url="#maintain-a-published-plugin" /%}
{% title-card title="Use Nx as Your Framework CLI" url="#use-nx-as-your-framework-cli" /%}

{% /cards %}

## Use a Plugin

Plugins allow you to easily adopt the industry standard practices for a particular framework without bearing all the maintenance burden. By tapping into the expertise of the plugin maintainers, you're freed up to focus on features that are specific to your application domain.

{% cards cols="2" %}

{% card title="Browse Existing Plugins" description="Find a plugin to use" url="/plugins/registry" /%}
{% card title="Use Task Executors" description="Run operations on your code" url="/plugin-features/use-task-executors" /%}
{% card title="Use Code Generators" description="Create or modify code" url="/plugin-features/use-code-generators" /%}
{% card title="Automate Updating Dependencies" description="Keep code up to date with package breaking changes" url="/core-features/automate-updating-dependencies" /%}

{% /cards %}

## Create a Local Plugin

Local plugins allow you to automate and centralize repository specific tasks. You can automate code creation and modification tasks with [code generators](/plugins/recipes/local-generators). Instead of writing a 7 step guide in a readme file, you can create a generator to prompt the developer for inputs and modify the code directly. Make scripts and their flags easily discoverable with [executors](/plugins/recipes/local-executors). And [Nx Console](/core-features/integrate-with-editors) offers a ready-made UI for your repo specific tasks.

{% cards cols="3" %}

{% card title="Create a Plugin" description="Set up a new plugin" url="/plugins/intro/create-plugin" /%}
{% card title="Local Generators" description="Add a generator to your plugin" url="/plugins/generators/local-generators" /%}
{% card title="Local Executors" description="Add an executor to your plugin" url="/plugins/executors/creating-custom-executors" /%}

{% /cards %}

## Maintain a Published Plugin

If your plugin has functionality that would be useful in more than just your repo, you can publish it to npm and register it on the nx.dev site for others to find. When other repos start using your plugin, you'll want to create migration generators to help them stay up to date whenever you make breaking changes.

{% cards cols="2" %}

{% card title="Migration Generators" description="Update repos when you introduce breaking changes" url="/plugins/advanced/migration-generators" /%}
{% card title="Share Your Plugin" description="Submit your plugin to the Nx plugin registry" url="/plugins/advanced/share-your-plugin" /%}

{% /cards %}

## Use Nx as Your Framework CLI

Framework authors can build a CLI tool for their users on top of Nx. Generators allow users to create the building blocks for the framework. Executors allow users to focus on using the framework instead of worrying about the build and test tooling. Migration generators make it easy for users to stay up to date with the latest version of the framework.

With Nx 16, framework authors can now provide a seamless initial express by authoring a `create-my-framework` package that will automatically run a `preset` generator to scaffold a new workspace. Authors can also hook into the way Nx identifies projects and creates the project graph so the users aren't required to have `project.json` files if the dependency information is already specified in a different file.

{% cards cols="3" %}

{% card title="Scaffold a New Workspace" description="Set up your framework in a new repo" url="/plugins/advanced/create-preset" /%}
{% card title="Project Inference Plugins" description="Modify how Nx identifies projects" url="/plugins/advanced/project-inference-plugins" /%}
{% card title="Project Graph Plugins" description="Modify the Nx graph" url="/plugins/advanced/project-graph-plugins" /%}

{% /cards %}
