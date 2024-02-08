# Getting Started with Plugins

Nx plugins contain [generators](/features/generate-code) and [executors](/concepts/executors-and-configurations) that extend the capabilities of an Nx workspace. They can be shared as npm packages or referenced locally within the same repo.

{% cards cols="4" %}

{% link-card title="Use a Plugin" url="#use-a-plugin" /%}
{% link-card title="Create a Plugin" url="#create-a-local-plugin" /%}
{% link-card title="Maintain a Published Plugin" url="#maintain-a-published-plugin" /%}
{% link-card title="Advanced Plugins" url="#advanced-plugins" /%}

{% /cards %}

## Use a Plugin

Nx plugins help you scaffold new projects, pre-configure tooling, follow best practices, and modularize your codebase.

{% cards cols="3" %}

{% card title="Browse Existing Plugins" description="Find a plugin to use" url="/plugin-registry" /%}
{% card title="Use Task Executors" description="Run operations on your code" url="/concepts/executors-and-configurations" /%}
{% card title="Generate Code" description="Create or modify code" url="/features/generate-code" /%}

{% /cards %}

## Create a Local Plugin

Local plugins allow you to automate repository specific tasks and enforce best practices (e.g., generating projects or components, running third-party tools).

{% cards cols="3" %}

{% card title="Create a Plugin" description="Set up a new plugin" url="/extending-nx/tutorials/create-plugin" /%}
{% card title="Local Generators" description="Add a generator to your plugin" url="/extending-nx/recipes/local-generators" /%}
{% card title="Local Executors" description="Add an executor to your plugin" url="/extending-nx/recipes/local-executors" /%}

{% /cards %}

## Maintain a Published Plugin

If your plugin has functionality that would be useful in more than just your repo, you can publish it to npm and register it on the nx.dev site for others to find.

{% cards cols="2" %}

{% card title="Share Your Plugin" description="Submit your plugin to the Nx plugin registry" url="/extending-nx/tutorials/publish-plugin" /%}
{% card title="Migration Generators" description="Update repos when you introduce breaking changes" url="/extending-nx/recipes/migration-generators" /%}

{% /cards %}

## Advanced Plugins

You can also hook into the way Nx works and modify it to suit your needs

{% cards cols="2" %}

{% card title="Scaffold a New Workspace" description="Set up a new repo" url="/extending-nx/recipes/create-preset" /%}
{% card title="Project Graph Plugins" description="Modify the Nx graph" url="/extending-nx/recipes/project-graph-plugins" /%}

{% /cards %}
