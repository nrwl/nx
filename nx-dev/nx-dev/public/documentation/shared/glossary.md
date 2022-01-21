# Glossary

## Computational Cache

A mechanism that allows Nx to understand the changes made to the workspace.

[Learn more](/using-nx/caching)

## Dependency Graph (dep-graph)

A representation of all the dependencies between projects in the workspace.

See a visual representation of the dependency graph by running `npx nx dep-graph` or check out
this [demo video](https://www.youtube.com/watch?v=UTB5dOJF43o).

## Distributed Task Execution (DTE)

A feature of Nx that allows the execution of a task graph across multiple machines instead of locally.

[Learn more](/using-nx/dte)

## Generators

Generators provide a way to automate many tasks you regularly perform as part of your development workflow.

## Executors

Executors perform actions on your code. This can include building, linting, testing, serving and many other actions.

[Learn more](/executors/using-builders)

## Migrations

Migrations are a special kind of generator that will automatically help you update to a new version for your project. run `nx migrate --help` for more information.

## Module Boundaries

A linting rule that allows you to leverage tags to define rules around the dependency graph

[Learn more](/structure/monorepo-tags)

## Monorepo

A monorepo is a single git repository that holds the source code for multiple applications and libraries, along with the
tooling for them.

[Learn more](/guides/why-monorepos)

## Plugin

A way to extend the functionality of Nx. Plugins help in various ways such as automating boilerplate tasks and
streamlining integrations It's important to note that plugins are not required to use Nx. Learn more
about [Nx without plugins](/getting-started/nx-core)

[Learn more about Nx plugins](nx-plugin/overview)

## Tags

a generic mechanism for expressing constraints

[Learn more](/structure/monorepo-tags#tags)

## Workspace

A workspace is a directory (typically the root of a monorepo) that contains multiple applications and libraries.
