# Nx Setup

## Install Nx

Install Nx with npm:

```bash
npm install -g nx
```

## Set up a New Nx Workspace

Creating an Nx workspace is done with a single command. Run the following command to set up an Nx workspace with a React app in it.

```bash
npx create-nx-workspace --preset=react
```

## Add Nx to an Existing Project

If you have an existing Create React App project, you can gain the benefits of Nx's computation cache and distributed task execution without modifying the file structure by running this command:

```bash
npx cra-to-nx
```

If you have an existing Lerna or Yarn monorepo, you can gain the benefits of Nx's computation cache and distributed task execution without modifying the file structure by running this command:

```bash
npx add-nx-to-monorepo
```

For more information on adding Nx to an existing repository see the [migration guide](/react/migration/migration-cra)

## Configuration

Nrwl maintains plugins for [Jest](/{{framework}}/jest/overview), [Cypress](/{{framework}}/cypress/overview), [ESLint](/{{framework}}/linter/eslint), [Storybook](/{{framework}}/storybook/overview) and more, so these tools can be easily added to your repo without the initial cost of setting up configuration files. As new versions of these tools are released, [`nx migrate latest`](/{{framework}}/core-concepts/updating-nx) automatically updates your configuration files, and even source code, to work with the next version. There is a growing list of [community plugins](/community) that support other tools.

Need to customize your configuration somehow? Configuration files can be modified for the whole repository or at an individual project level. For instance, `libA` has a `tsconfig.json` file that extends the global `tsconfig.base.json` file:

```treeview
myorg/
├── apps/
├── libs/
│   └── libA/
│       ├── src/
│       └── tsconfig.json
├── package.json
└── tsconfig.base.json
```

## Folder Structure

Nx does not require your workspace to have a particular file structure, but many teams end up having something similar to this:

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

`/libs/` contains the library projects. There are many kinds of libraries, and each library defines its own external API so that boundaries between libraries remain clear.

`/tools/` contains scripts that act on your code base. This could be database scripts, [custom executors](/{{framework}}/executors/creating-custom-builders), or [workspace generators](/{{framework}}/generators/workspace-generators).

`/workspace.json` lists every project in your workspace.

`/nx.json` configures the Nx CLI itself. It tells Nx what needs to be cached, how to run tasks etc.

`/tsconfig.base.json` sets up the global TypeScript settings and creates aliases for each library to aid when creating TS/JS imports.
