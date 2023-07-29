# Dependency Management Strategies

Where do you define the dependencies of your projects? Do you have a single `package.json` file at the root or a separate `package.json` for each project? What are the pros and cons of each approach?

## Independently Maintained Dependencies

Without tools like Nx, this is the only dependency maintenance strategy possible. Each project is responsible for defining which dependencies to use during development and which dependencies to bundle with the deployed artifact. For javascript, these dependencies are specified in a separate `package.json` file for each project. Each project's build command is responsible for bundling the packages in the `dependencies` section into the final build artifact. Typically packages are installed across the repo using yarn/npm workspaces.

This strategy makes it very easy to have different versions of the same dependency used on different projects. This seems helpful because the code for each project exists in the same folder structure, but that code can't really be shared any more. If project1 and project2 use two different versions of React, what version of React will their shared code be written against? No matter how you answer, there will be bugs introduced in the system and often these bugs occur at runtime and are very difficult to diagnose.

Another potential problem with this approach is that sometimes a developer may have one version of a dependency installed in the root `node_modules` and a different version specified in the project's `package.json`. This can lead to a scenario where the app works correctly on the developer's machine but fails in production with the bundled version of the dependency. This is once again a bug that is difficult to diagnose.

## Single Version Policy

With this strategy, developers define all dependencies in the root `package.json` file. This enforces a single version for all dependencies across the codebase, which avoids the problems listed above. Individual projects may still have `package.json` files, but they are used only for the metadata defined there, not as a way of defining the dependencies of that project.

If there are React and Angular apps in the same repo, we don't want both frameworks bundled in the build artifacts of the individual apps. That's why the plugins Nx provides come with executors that use Nx's graph of dependencies to automatically populate the `dependencies` section of the individual `package.json` files in the build output and pre-populate a lock file for you. This enables your build artifacts to only contain the dependencies that are actually used by that app. As soon as a developer removes the last usage of a particular dependency, that dependency will be removed from the bundle.

The primary concern people have with this approach is that of coordinating updates. If two different teams are working on React apps in the same repo, they'll need to agree about when to upgrade React across the repo. This is a valid concern and beyond the scope of Nx to solve. If the developers can't cooperate, they should probably work in separate repos. On the other hand, if the teams can agree, it becomes much less work to upgrade the whole repo at the same time rather than performing that same upgrade process multiple times spread out over months or years. Performing the same code manipulation 100 places all at once is much easier than remembering how to perform that code manipulation 100 different times spread out over a year.

Consult the Nx executor's reference page to find options for populating dependencies and a lock file. If you would like to use Nx's graph to populate the dependencies of a project in your own scripts or custom executor, read about how to [prepare applications for deployment via CI](/recipes/ci/ci-deployment).
