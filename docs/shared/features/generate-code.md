# Generate Code

Generators provide a way to automate many tasks you regularly perform as part of your development workflow. Whether it is scaffolding out components, features, ensuring libraries are generated and structured in a certain way, or updating your configuration files, generators help you standardize these tasks in a consistent, and predictable manner.

## Types of Generators

There are three main types of generators:

1. **Plugin Generators** are available when an Nx plugin has been installed in your workspace.
2. **Local Generators** are generators that you can create for your own workspace. [Local generators](/extending-nx/recipes/local-generators) allow you to codify the processes that are unique to your own organization.
3. **Update Generators** are invoked by Nx plugins when you [update Nx](/recipes/adopting-nx) to keep your config files in sync with the latest versions of third party tools.

## Invoking Plugin Generators

Generators allow you to create or modify your codebase in a simple and repeatable way. Generators are invoked using the [`nx generate`](/nx-api/nx/documents/generate) command.

```shell
nx generate [plugin]:[generator-name] [options]
nx generate @nx/react:component mycmp --project=myapp
```

It is important to have a clean git working directory before invoking a generator so that you can easily revert changes and re-invoke the generator with different inputs.

## Build your own Generator

Nx comes with a Devkit that allows you to build your own generator for your Nx workspace. Learn more about it on [our docs page](/extending-nx/recipes/local-generators) or have a look at the video below:

{% youtube
src="https://www.youtube.com/embed/myqfGDWC2go"
title="Scaffold new Pkgs in a PNPM Workspaces Monorepo"
caption="Demoes how to use Nx generators in a PNPM workspace to automate the creation of libraries"
/%}

## See Also

- [nx.json generator defaults](/reference/nx-json#generators)
