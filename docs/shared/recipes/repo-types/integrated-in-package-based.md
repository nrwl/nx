# Add an Integrated Project in a Package-based Repository

In a package-based repository, you've intentionally opted out of some of Nx's features in order to give yourself more flexibility. If you decide to add a new project using the integrated style, the process is straight-forward.

To add an integrated project:

1. Install the plugin you want to use (i.e. `nx add @nx/react`)
2. Generate an application or library using that plugin (i.e. `nx g @nx/react:app`)

The integrated project is now ready to use. Next, we'll discuss some of the changes that were applied to your codebase.

## package.json dependencies

All the dependencies that are required for an integrated project are maintained in the root `package.json` file. In order to use the plugin's [Automate Updating Framework Dependencies](/features/automate-updating-dependencies) feature, we recommend using a [Single Version Policy](/concepts/decisions/dependency-management#single-version-policy) for integrated projects.

## tsconfig.base.json

Even if the project you added only uses javascript, a `tsconfig.base.json` file is generated in the root of the repo. This file is needed for the tooling that Nx provides. Nx creates a typescript `path` alias for each library and then uses that path (rather than npm/yarn/pnpm workspaces) to allow local projects to reference the library.

## project.json

The project itself will have [a `project.json` file](/reference/project-configuration#project-level-configuration-files) where some tasks might be explicitly defined while other [tasks will be inferred by the plugin](/concepts/inferred-tasks) used. This can include tasks like `build`, `serve` and `test`.

## Other Configuration Files

Depending on the type of integrated project you created, there may be other configuration files. These could include files like `.eslintrc.json`, `jest.config.ts` and a project-level `tsconfig.json`.

## Code Generators

The Nx plugin you installed provides code generators that you can use to scaffold out your application quickly and in a consistent way. See [Use Code Generators](/features/generate-code) for more information.

## Summary

You can opt in to using Nx's integrated features on a per project basis. This allows you to experiment with the functionality to see if the value those features provide is worth giving up some of the flexibility a package-based repository gives you.
