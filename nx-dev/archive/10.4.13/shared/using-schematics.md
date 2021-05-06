# Using Schematics

## Overview

Schematics provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, ensuring libraries are generated and structured in a certain way, or updating your configuration files, schematics help you standardize these tasks in a consistent, and predictable manner.

Schematics are developed by the Angular Team at Google as part of the Angular DevKit, but are provided independently of the Angular framework. The DevKit packages are provided under the [@angular-devkit](https://npmjs.com/~angular-devkit) scope on npm. Nx provides additional tooling around creating, and running custom schematics from within your workspace.

To read more about the concepts of Schematics, and building an example schematic, see the [Schematics Authoring Guide](https://angular.io/guide/schematics-authoring).

The [Workspace Schematics](/{{framework}}/workspace/schematics/workspace-schematics) guide shows you how to create, run, and customize workspace schematics within your Nx workspace.

## Types of Schematics

There are three main types of schematics:

1. **Plugin Schematics** are available when an Nx plugin has been installed in your workspace.
2. **Workspace Schematics** are schematics that you can create for your own workspace. [Workspace schematics](/{{framework}}/workspace/schematics/workspace-schematics) allow you to codify the processes that are unique to your own organization.
3. **Update Schematics** are invoked by Nx plugins when you [update Nx](/{{framework}}/workspace/update) to keep your config files in sync with the latest versions of third party tools.

## Invoking Plugin Schematics

Schematics allow you to create or modify your codebase in a simple and repeatable way. Schematics are invoked using the [`nx generate`](/{{framework}}/cli/generate) command.

```bash
nx generate [plugin]:[schematic-name] [options]
nx generate @nrwl/react:component mycmp --project=myapp
```

It is important to have a clean git working directory before invoking a schematic so that you can easily revert changes and re-invoke the schematic with different inputs.
