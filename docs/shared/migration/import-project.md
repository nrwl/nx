---
title: Import an Existing Project into an Nx Workspace
description: Learn how to use the nx import command to move projects between repositories while preserving git history, managing dependencies, and handling external code references.
---

# Import an Existing Project into an Nx Workspace

{% youtube src="https://youtu.be/hnbwoV2-620" title="Importing an existing project into your monorepo" /%}

Nx can help with the process of moving an existing project from another repository into an Nx workspace. In order to communicate clearly about this process, we'll call the repository we're moving the project out of the "source repository" and the repository we're moving the project into the "destination repository". Here's an example of what those repositories might look like.

{% side-by-side %}

```{% fileName="Source Repository" %}
└─ inventory-app
   ├─ ...
   ├─ public
   │  └─ ...
   ├─ src
   │  ├─ assets
   │  ├─ App.css
   │  ├─ App.tsx
   │  ├─ index.css
   │  └─ main.tsx
   ├─ .eslintrc.cjs
   ├─ index.html
   ├─ package.json
   ├─ README.md
   ├─ tsconfig.json
   ├─ tsconfig.node.json
   └─ vite.config.ts
```

```{% fileName="Destination Repository" %}
└─ myorg
   ├─ ...
   ├─ packages
   │  └─ ...
   ├─ apps
   │  ├─ account
   │  │  └─ ...
   │  ├─ cart
   │  │  └─ ...
   │  └─ users
   │     └─ ...
   ├─ .eslintrc.json
   ├─ .gitignore
   ├─ nx.json
   ├─ package.json
   ├─ README.md
   └─ tsconfig.base.json
```

{% /side-by-side %}

In this example, the source repository contains a single application while the destination repository is already a monorepo. You can also import a project from a sub-directory of the source repository (if the source repository is a monorepo, for instance). The `nx import` command can be run with no arguments and you will be prompted to for the required arguments:

```shell
nx import
```

Make sure to run `nx import` from within the **destination repository**.

You can also directly specify arguments from the terminal, like one of these commands:

```shell {% path="~/myorg" %}
nx import [sourceRepository] [destinationDirectory]
nx import ../inventory-app apps/inventory
nx import https://github.com/myorg/inventory-app.git apps/inventory
```

{% callout type="note" title="Source Repository Local or Remote" %}
The sourceRepository argument for `nx import` can be either a local file path to the source git repository on your local machine or a git URL to the hosted git repository.
{% /callout %}

The `nx import` command will:

- Maintain the git history from the source repository
- Suggest adding plugins to the destination repository based on the newly added project code

Every code base is different, so you will still need to manually:

- Manage any dependency conflicts between the two code bases
- Migrate over code outside the source project's root folder that the source project depends on

## Manage Dependencies

If both repositories are managed with npm workspaces, the imported project will have all its required dependencies defined in its `package.json` file that is moved over. You'll need to make sure that the destination repository includes the `destinationDirectory` in the `workspaces` defined in the root `package.json`.

If the destination repository does not use npm workspaces, it will ease the import process to temporarily enable it. With npm workspaces enabled, you can easily import a self-contained project and gain the benefits of code sharing, atomic commits and shared infrastructure. Once the import process is complete, you can make a follow-up PR that merges the dependencies into the root `package.json` and disables npm workspaces again.

## Migrate External Code and Configuration

Few projects are completely isolated from the rest of the repository where they are located. After `nx import` has run, here are a few types of external code references that you should account for:

- Project configuration files that extend root configuration files
- Scripts outside the project folder that are required by the project
- Local project dependencies that are not present or have a different name in the destination repository

{% callout type="note" title="Importing Multiple Projects" %}
If multiple projects need to be imported into the destination repository, try to import as many of the projects together as possible. If projects need to be imported with separate `nx import` commands, start with the leaf projects in the dependency graph (the projects without any dependencies) and then work your way up to the top level applications. This way every project that is imported into the destination repository will have its required dependencies available.
{% /callout %}
