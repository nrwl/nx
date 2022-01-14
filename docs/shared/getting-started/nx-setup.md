# Nx Setup

## Set up a New Nx Workspace

> (placeholder) explain what a "workspace" is or link to a glossary of terms we use?

Create a new Nx workspace by running the follow command and follow the prompts

```bash
# pass @latest in case npx cached an older version of create-nx-workspace
npx create-nx-workspace@latest
```

Nx provides a handful of presets to assist in organizing your workspace. You can choose which ever makes the most sense for your project.

(Placeholder) learn more about presets and why would want to use them.

```bash
# create an empty workspace set up for building applications
npx create-nx-workspace --preset=empty

# create an empty workspace set up for building packages
npx create-nx-workspace --preset=core

# create an empty workspace set up for building packages with the @nrwl/js plugin installed
npx create-nx-workspace --preset=ts
```

Some presets are set up to build apps with common frameworks

```bash
npx create-nx-workspace --preset=@nrwl/remix

npx create-nx-workspace --preset=react

npx create-nx-workspace --preset=react-native

npx create-nx-workspace --preset=angular
```

## Install Nx CLI

To make the developer experience nicer, you may want to install the Nx CLI globally.

```bash
npm install -g nx
```

Optionally, you can use `npx nx` or `yarn nx` to run the CLI.

## Add Nx to an Existing Project

// (Placeholder) is this only for Lerna or Yarn monorepos?

If you have an existing Lerna or Yarn monorepo, you can gain the benefits of Nx's computation cache and distributed task execution without modifying the file structure by running the following command:

```bash
npx add-nx-to-monorepo
```

You can easily add Nx to and existing Create React App project by running the following command:

```bash
npx cra-to-nx
```

Learn more about migrating Create React Apps to Nx via our [Create React App migration guide](/migration/migration-cra)

## Folder Structure

Nx can be added to any workspace, there is no fixed folder structure. However, if you use an existing presets, you will likely see something like this:

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
