# Add a Package-Based Project in an Integrated Repository

An integrated repo offers a lot of features at the cost of some flexibility, but sometimes you want to take back control of your build system or dependency management for a single project in the repo. This recipe shows you how to do that.

A package-based project in an integrated repository is a project that has at least one of these characteristics:

1. Maintains its own dependencies with a separate package.json file
2. Runs tasks without the use of an Nx plugin
3. Scaffolds code without the use of Nx generators

For this example, we'll implement all three, but you can also have a project that has only one of these characteristics and falls back to an integrated style for the others.

## Create Your Project

Because this is a package-based project, we won't use Nx to generate the project. We can create the project in whatever way is typical for the framework you're trying to add. This could mean using the framework's own CLI or manually adding files yourself.

For Nx to be aware of your project, it needs:

1. npm, yarn or pnpm workspaces set up in the root `package.json` file
2. A `package.json` file in the project folder with a `name` specified
3. Some scripts defined in the project's `package.json` file for Nx to run

## Maintain Separate Dependencies

If you choose to have this project define its own dependencies separately from the root `package.json` file, simply define those `dependencies` and `devDependencies` in the project's `package.json` file.

With [npm](https://docs.npmjs.com/cli/v7/using-npm/workspaces)/[yarn](https://classic.yarnpkg.com/lang/en/docs/workspaces/)/[pnpm](https://pnpm.io/workspaces) workspaces set up, you can run the install command at the root of the repository and every project will have its dependencies installed.

There are difficulties with code sharing when you maintain separate dependencies. See the [Dependency Management Strategies](/more-concepts/dependency-management) guide for more information.

## Run Tasks Without the Use of an Nx Plugin

Any task you define in the scripts section of the project's `package.json` can be executed by Nx. These scripts can be cached and orchestrated in the same way a `target` defined in `project.json` is. If you want to define some tasks in `project.json` and some tasks in `package.json`, Nx will read both and merge the configurations.

## Scaffold Code Without the Use of Nx Generators

Whatever tools you want to use to help scaffold out code should work just fine in an Nx repo. You can even call other code mod tools from within an Nx generator (see [Using jscodeshift Codemods](/plugins/recipes/composing-generators#using-jscodeshift-codemods)).

## Updating Dependencies

Because this is a package-based project, you'll be managing your own updates for this project. In addition, you'll need to be careful when running the `nx migrate` command on the rest of the repo. There may be times where a migration changes code in this package-based project when it shouldn't. You'll need to manually revert those changes before committing.

## Summary

An integrated Nx repo does not lock you into only using Nx plugins for all of your projects. You can always opt-out of using certain features and take on the responsibility of managing that functionality yourself.
