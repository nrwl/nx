# Integrated Repo Folder Structure

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

`/libs/` contains the library projects. There are many kinds of libraries, and each library defines its own external API so that boundaries between libraries remain clear.

`/tools/` contains scripts that act on your code base. This could be database scripts, [custom executors](/recipe/creating-custom-executors), or [workspace generators](/recipe/workspace-generators).

`/workspace.json` lists every project in your workspace. (this file is optional)

`/nx.json` configures the Nx CLI itself. It tells Nx what needs to be cached, how to run tasks etc.

`/tsconfig.base.json` sets up the global TypeScript settings and creates aliases for each library to aid when creating TS/JS imports.
