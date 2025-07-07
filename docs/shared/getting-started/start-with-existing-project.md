---
title: Start with an existing project
description: Add Nx to any existing project with a single command. Start with Nx Core and gradually adopt plugins, CI integrations, and other capabilities.
---

# Add Nx to an existing project

In many situations, you have an existing codebase and want to improve it with Nx using an **incremental adoption approach**.

Thanks to [Nx's modular architecture](/getting-started/intro), you can start with just **Nx Core** and then gradually add [technology-specific plugins](/technologies), [CI integrations](/ci), or other capabilities as your requirements evolve.

Getting started is remarkably simple. You can add Nx to any existing project with a single command:

```shell
nx init
```

_(Note, make sure you have [Nx installed globally](/getting-started/installation) or use `npx` if you're in a JavaScript environment)_

This command automatically detects your underlying workspace structure, whether it's a monorepo, a single project, or something in between. Nx will then ask you a series of targeted questions about your setup and preferences, using your answers to auto-configure itself seamlessly into your existing workspace. This intelligent setup process ensures you get the benefits of Nx with minimal configuration changes or disruption to your current development workflow.

Here are some guides that give you more details based on the technology stack you're using:

{% cards cols="2" mdCols="4" smCols="2" moreLink="/recipes/adopting-nx" %}

{% link-card title="Add to Existing Monorepo" appearance="small" url="/recipes/adopting-nx/adding-to-monorepo" icon="pnpm" /%}

{% link-card title="Add to Any Project" appearance="small" url="/recipes/adopting-nx/adding-to-existing-project" icon="nx" /%}

{% link-card title="Migrate from Angular CLI" appearance="small" url="technologies/angular/migration/angular" icon="angular" /%}

{% link-card title="Import Projects into Your Nx Workspace" appearance="small" url="/recipes/adopting-nx/import-project" icon="ArrowDownOnSquareStackIcon" /%}

{% /cards %}
