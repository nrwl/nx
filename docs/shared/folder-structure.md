# Folder Structure

## Files

Every Nx workspace has a file structure like this:

```treeview
myorg/
├── apps/
├── libs/
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```

Nx makes it easy to split up your code into separate projects. Projects come in two varieties - applications and libraries.

`/apps/` contains the application projects. These are the main entry point for a runnable application. We recommend keeping applications as light-weight as possible, with all the heavy lifting being done by libraries that are imported by each application.

`/libs/` contains the library projects. There are many different kinds of libraries, and each library defines its own external api so that boundaries between libraries remain clear.

`/tools/` contains scripts that act on your code base. This could be database scripts, custom executors (or builders) or workspace generators.

`/workspace.json` defines each project in your workspace and the executors that can be run on those projects.

`/nx.json` adds extra information about projects, including manually defined dependencies and tags that can be used to restrict the ways projects are allowed to depend on each other.

`/tsconfig.json` sets up the global typescript settings and creates aliases for each library to aid when creating typescript imports.

## Configuration

Many of the tools that Nx provides as plugins have a global configuration file that can be found at the root of workspace and a project-specific configuration file found at the root of each project that overrides the global settings for that project.

For instance, `libA` has a `tsconfig.json` file that extends the global `tsconfig.json` file:

```treeview
myorg/
├── apps/
├── libs/
│   └── libA/
│       ├── src/
│       └── tsconfig.json
├── tools/
├── workspace.json
├── nx.json
├── package.json
└── tsconfig.json
```
