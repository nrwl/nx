# Rescope

As of version 16, all the official Nx plugins are moving from the `@nrwl` npm scope to `@nx`. With our shift away from consulting, the Nrwl brand is becoming less recognizable and we're removing references to it in favor of the more well-known "Nx". The goal is for anyone looking through a list of dependencies to easily make the connection between the `nx` package and the `@nx` plugins that are associated with it.

## What Do You Need To Do?

For new repos, run `npx create-nx-workspace` as usual. The correct packages will be added.

For existing repos, run `nx migrate` as you normally would. When migrating to version 16 or higher, the package names will be automatically updated for you.

If, for some reason, you decide to keep the `@nrwl` scoped packages, they will still be available through version 17, but starting in version 18, only the `@nx` scoped packages will be available on the npm registry.
