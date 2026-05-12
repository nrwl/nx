---
title: Import an Existing Project into an Nx Workspace
description: Learn how to use the nx import command to move projects between repositories while preserving git history, managing dependencies, and handling external code references.
filter: 'type:Guides'
---

Nx can help with the process of moving an existing project from another repository into an Nx workspace. In order to communicate clearly about this process, we'll call the repository we're moving the project out of the "source repository" and the repository we're moving the project into the "destination repository". Here's an example of what those repositories might look like.

## Run Nx import with an AI agent

The deterministic `nx import` CLI handles the common path well, but most real migrations have workspace-specific quirks that need a follow-up: missing runtimes, conflicting tooling versions, scripts that reference paths outside the project, and so on. An AI agent (Claude Code, Codex, Cursor, etc.) can fill that gap by driving `nx import` through the CLI and reacting to failures as they come up.

{% youtube src="https://youtu.be/mUG292kkz0w" title="Importing projects with an AI agent" /%}

Before prompting the agent, make sure the Nx skills are installed via `nx configure-ai-agents` so the agent has the `nx import` skill available. See the [AI setup guide](/docs/getting-started/ai-setup) for details.

As an example, say you have the following layout with two source projects sitting next to an empty Nx monorepo:

{% filetree %}

- demo/
  - nx-mono/
    - ... (destination Nx workspace)
  - source-gradle/
    - ... (Gradle Java project)
  - source-tanstack/
    - ... (TanStack Start project)

{% /filetree %}

From inside `nx-mono`, prompt the agent and explicitly mention the `nx import` skill so it gets loaded. For example:

> Can you merge/import the gradle and tanstack projects in `../` into this monorepo. The apps for both should go into the `./apps` folder and the packages into the `./packages` folder. Make sure that git history is preserved and also run some tests like running builds and inspecting the project graph to make sure the migration is successful. Use the `nx import` skill.

The agent observes the migration as it runs, executes builds, inspects the project graph, and fixes workspace-specific issues that the deterministic CLI can't predict (for example installing a missing runtime via `mise`, reconciling dependency versions, or moving shared configuration).

## Run Nx import manually

{% youtube src="https://youtu.be/hnbwoV2-620" title="Importing an existing project into your monorepo" /%}

**Source Repository**

{% filetree %}

- inventory-app/
  - ... (other files)
  - public/
    - ... (public files)
  - src/
    - assets/
    - App.css
    - App.tsx
    - index.css
    - main.tsx
  - .eslintrc.cjs
  - index.html
  - package.json
  - README.md
  - tsconfig.json
  - tsconfig.node.json
  - vite.config.ts

{% /filetree %}
**Destination Repository**

{% filetree %}

- myorg/
  - ... (other files)
  - packages/
    - ... (shared packages)
  - apps/
    - account/
      - ... (account app files)
    - cart/
      - ... (cart app files)
    - users/
      - ... (users app files)
  - .eslintrc.json
  - .gitignore
  - nx.json
  - package.json
  - README.md
  - tsconfig.base.json

{% /filetree %}

In this example, the source repository contains a single application while the destination repository is already a monorepo. You can also import a project from a sub-directory of the source repository (if the source repository is a monorepo, for instance). The `nx import` command can be run with no arguments and you will be prompted to for the required arguments:

```shell
nx import
```

Make sure to run `nx import` from within the **destination repository**.

You can also directly specify arguments from the terminal, like one of these commands:

```shell
nx import [sourceRepository] [destinationDirectory]
nx import ../inventory-app apps/inventory
nx import https://github.com/myorg/inventory-app.git apps/inventory
```

{% aside type="tip" title="Source Repository Local or Remote" %}
The sourceRepository argument for `nx import` can be either a local file path to the source git repository on your local machine or a git URL to the hosted git repository.
{% /aside %}

The `nx import` command will:

- Maintain the git history from the source repository
- Suggest adding plugins to the destination repository based on the newly added project code

Every code base is different, so you will still need to manually:

- Manage any dependency conflicts between the two code bases
- Migrate over code outside the source project's root folder that the source project depends on

## Manage dependencies

If both repositories are managed with npm workspaces, the imported project will have all its required dependencies defined in its `package.json` file that is moved over. You'll need to make sure that the destination repository includes the `destinationDirectory` in the `workspaces` defined in the root `package.json`.

If the destination repository does not use npm workspaces, it will ease the import process to temporarily enable it. With npm workspaces enabled, you can easily import a self-contained project and gain the benefits of code sharing, atomic commits and shared infrastructure. Once the import process is complete, you can make a follow-up PR that merges the dependencies into the root `package.json` and disables npm workspaces again.

## Migrate external code and configuration

Few projects are completely isolated from the rest of the repository where they are located. After `nx import` has run, here are a few types of external code references that you should account for:

- Project configuration files that extend root configuration files
- Scripts outside the project folder that are required by the project
- Local project dependencies that are not present or have a different name in the destination repository

{% aside type="note" title="Importing Multiple Projects" %}
If multiple projects need to be imported into the destination repository, try to import as many of the projects together as possible. If projects need to be imported with separate `nx import` commands, start with the leaf projects in the dependency graph (the projects without any dependencies) and then work your way up to the top level applications. This way every project that is imported into the destination repository will have its required dependencies available.
{% /aside %}
