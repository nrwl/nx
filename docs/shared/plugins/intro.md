# Extending Nx with Plugins

Nx's core functionality focuses on task running and understanding your project and task graph. Nx plugins leverage that functionality to enforce best practices, seamlessly integrate tooling and allow developers to get up and running quickly. Nx plugins are composed of a few basic components:

- [Generators](/features/generate-code)
- [Inferred tasks](/extending-nx/recipes/project-graph-plugins)
- [Executors](/concepts/executors-and-configurations)
- [Presets](/extending-nx/recipes/create-preset) and [install scripts](/extending-nx/recipes/create-install-package)

The way these components are implemented depends on the goal of that specific plugin.

## Use a Plugin

Nx plugins help you scaffold new projects, pre-configure tooling, follow best practices, and modularize your codebase.

{% cards cols="4" %}

{% card title="Browse Existing Plugins" description="Find a plugin to use" url="/plugin-registry" /%}
{% card title="Generate Code" description="Create or modify code" url="/features/generate-code" /%}
{% card title="Understand Inferred Tasks" description="Infer tasks based on tooling configuration" url="/concepts/inferred-tasks" /%}
{% card title="Use Task Executors" description="Run operations on your code" url="/concepts/executors-and-configurations" /%}

{% /cards %}

## Create a Plugin

We can classify plugins in three groups based on the purpose of the plugin. To get started creating a plugin, choose from the following tutorials based on the purpose of your plugin:

{% cards cols="2" %}

{% card title="Organization Specific Plugin" description="Enforce best practices for the repository" url="/extending-nx/tutorials/organization-specific-plugin" /%}
{% card title="Maintain a Published Plugin" description="Share your plugin with the community" url="/extending-nx/tutorials/publish-plugin" /%}

<!-- {% card title="Tooling Plugin" description="Easily integrate a tool into an Nx workspace" url="/features/generate-code" /%}
{% card title="Repository Structure Plugin" description="Set up and maintain a particular structure for the entire repository" url="/concepts/inferred-tasks" /%} -->

{% /cards %}
