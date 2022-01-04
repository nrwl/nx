# Using Generators

## Overview

Generators provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, ensuring libraries are generated and structured in a certain way, or updating your configuration files, generators help you standardize these tasks in a consistent, and predictable manner.

The [Workspace Generators](/{{framework}}/generators/workspace-generators) guide shows you how to create, run, and customize workspace generators within your Nx workspace.

## Types of Generators

There are three main types of generators:

1. **Plugin Generators** are available when an Nx plugin has been installed in your workspace.
2. **Workspace Generators** are generators that you can create for your own workspace. [Workspace generators](/{{framework}}/generators/workspace-generators) allow you to codify the processes that are unique to your own organization.
3. **Update Generators** are invoked by Nx plugins when you [update Nx](/{{framework}}/using-nx/updating-nx) to keep your config files in sync with the latest versions of third party tools.

## Invoking Plugin Generators

Generators allow you to create or modify your codebase in a simple and repeatable way. Generators are invoked using the [`nx generate`](/{{framework}}/cli/generate) command.

```bash
nx generate [plugin]:[generator-name] [options]
nx generate @nrwl/react:component mycmp --project=myapp
```

It is important to have a clean git working directory before invoking a generator so that you can easily revert changes and re-invoke the generator with different inputs.
