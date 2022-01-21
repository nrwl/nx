# Glossary

## Computational Cache

A mechanism that allows Nx to replay tasks performed on the codebase. Examples of tasks include building, testing and linting.

[Learn more](/using-nx/caching)

## Distributed Task Execution (DTE)

Nx Cloud coordinates executing tasks across multiple machines, balancing out the work load according to the time each task takes to complete.

[Learn more](/using-nx/dte)

## Generators

Generators automate adding, modifying or deleting code.

## Executors

Executors perform actions on code. This can include building, linting, testing, serving and many other actions.

[Learn more](/executors/using-builders)

## Migrations

Migrations are a special kind of generator that will automatically help you update to a new version for your project. run `nx migrate --help` for more information.

## Module Boundaries

A linting rule that allows you to leverage tags to define rules around the dependency graph

[Learn more](/structure/monorepo-tags)

## Monorepo

A monorepo is a single repository containing multiple distinct projects, with well-defined relationships.

[Learn more](https://monorepos.tools)

## Plugin

A way to extend the functionality of Nx. Plugins help in various ways such as automating boilerplate tasks and
streamlining integrations. It's important to note that plugins are not required to use Nx. Learn more
about [Nx without plugins](/getting-started/nx-core)

[Learn more about Nx plugins](nx-plugin/overview)

## Project Graph

A representation of all the dependencies between projects in the workspace.

See a visual representation of the project graph by running `npx nx graph` or check out
this [demo video](https://www.youtube.com/watch?v=UTB5dOJF43o).

## Tags

A generic mechanism for expressing constraints between projects

[Learn more](/structure/monorepo-tags#tags)

## Workspace

A workspace is a directory (typically the root of a monorepo) that contains multiple applications and libraries.
