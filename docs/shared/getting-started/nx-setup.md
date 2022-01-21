# Nx Setup

## Set up a New Nx Workspace

Run the following command to create a new [workspace](/getting-started/glossary#workspace).

```bash
# pass @latest in case npx cached an older version of create-nx-workspace
npx create-nx-workspace@latest
```

When creating a workspace, you will have to choose a preset, which will preconfigure a few things for you. If you're unsure using `core` or `apps` is a great starting point.

Some examples of preselecting a preset are:

```bash
# create an empty workspace set up for building applications
npx create-nx-workspace --preset=empty

# create an empty workspace set up for building packages
npx create-nx-workspace --preset=core

# create an empty workspace set up for building packages with the @nrwl/js plugin installed
npx create-nx-workspace --preset=ts
```

Some presets set up applications, e2e tests, etc.

```bash
npx create-nx-workspace --preset=react
npx create-nx-workspace --preset=react-native
npx create-nx-workspace --preset=angular
```

## Add Nx to an Existing Project

If you have an existing Lerna or Yarn monorepo, you can gain the benefits of Nx's [computation cache](/getting-started/glossary#computational-cache) and [distributed task execution](#distributed-task-execution-dte) without modifying the file structure by running this command:

```bash
npx add-nx-to-monorepo
```

If you have an existing Create React App project, you can gain the benefits of Nx's computation cache and distributed task execution without modifying the file structure by running this command:

```bash
npx cra-to-nx
```

Learn more about migrating Create React Apps projects to Nx via our [Create React App migration guide](/migration/migration-cra)

## Install Nx CLI

To make the developer experience nicer, you may want to install the Nx CLI globally.

```bash
npm install -g nx
```

## Folder Structure

Nx can be added to any workspace, so there is no fixed folder structure. However, if you use one of the existing presets, you will likely see something like this:

```treeview
myorg/
├── apps/
├── libs/
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.base.json
```

`/apps/` contains the application projects. This is the main entry point for a runnable application. We recommend keeping applications as light-weight as possible, with all the heavy lifting being done by libraries that are imported by each application.

`/libs/` contains the library projects. There are many kinds of libraries, and each library defines its own external API so that boundaries between libraries remain clear. Here are some [common library type recommendations](/workspace/library-types).

`/tools/` contains scripts that act on your code base. This could be database scripts, [custom executors](/executors/creating-custom-builders), or [workspace generators](/generators/workspace-generators).

`/workspace.json` lists every project in your workspace. (this file is optional)

`/nx.json` configures the Nx CLI itself. It tells Nx what needs to be cached, how to run tasks, etc.

`/tsconfig.base.json` sets up the global TypeScript settings and creates aliases for each library to aid when creating TS/JS imports.

## Next Steps

Learn about

- [Nx CLI](/using-nx/nx-cli)
- [Nx and Angular](/getting-started/nx-and-angular)
- [Nx and React](/getting-started/nx-and-react)
- [Nx and TypeScript](/guides/nx-and-ts)
- [Nx without Plugins](/getting-started/nx-core)
