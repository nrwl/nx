# Monorepos

A monorepo is a single git repository that holds the source code for multiple applications and libraries, along with the tooling for them.

## What are the benefits of a monorepo?

- **Shared code** - Keeps your code DRY across your entire organization. Reuse validation code, UI components, and types across the codebase. Reuse code between the backend, the frontend, and utility libraries.

- **Atomic changes** - Change a server API and modify the downstream applications that consume that API in the same commit. You can change a button component in a shared library and the applications that use that component in the same commit. A monorepo saves the pain of trying to coordinate commits across multiple repositories.

- **Developer mobility** - Get a consistent way of building and testing applications written using different tools and technologies. Developers can confidently contribute to other teams’ applications and verify that their changes are safe.

- **Single set of dependencies** - Use a single version of all third-party dependencies, reducing inconsistencies between applications. Less frequently used applications are still kept up-to-date with the latest version of a framework, library, or build tool.

## Why not code collocation?

A basic implementation of a monorepo is code collocation, where you combine all the code from multiple repositories into the same repo without adequate tooling to coordinate everything. What problems arise from code collocation?

- **Running unnecessary tests** - All tests in the entire repository run to ensure nothing breaks from a given change. Even code in projects that are unrelated to the actual change.

- **No code boundaries** - Bugs and inconsistencies are added by a developer from another team changing code in your project. Or worse, another team uses code that you only intended for private use in their application. Now another project code depends on it, keeping you from making changes that may break their application.

- **Inconsistent tooling** - Each project uses its own set of commands for running tests, building, serving, linting, deploying, and so forth. Inconsistency creates mental overhead remembering which commands to use from project to project.

Tools like Lerna and Yarn Workspaces help optimize the installation of node modules, but they **do not** enable Monorepo-style development. In other words, they solve an orthogonal problem and even can are used in combination with Nx. Read more on it [here](https://blog.nrwl.io/why-you-should-switch-from-lerna-to-nx-463bcaf6821).

## Nx enhances monorepos

Nx provides tools to give you the benefits of a monorepo without the drawbacks of simple code collocation.

### Scaling your monorepo

- **Consistent Command Execution** - Executors allow for consistent commands to test, serve, build, and lint each project using various tools.

- **Consistent Code Generation** - Generators allow you to customize and standardize organizational conventions and structure, removing the need to perform the same manual setup tasks repetitively.

- **Affected Commands** - [Nx’s affected commands](/latest/{{framework}}/cli/affected) analyze your source code, the context of the changes, and only runs tasks on the affected projects impacted by the source code changes.

- **Distributed Caching** - Nx provides local caching and support for distributed caching of command executions. With distributed caching, when someone on your team runs a command, everyone else gets access to those artifacts to speed up their command executions, bringing them down from minutes to seconds. Nx helps you scale your development to massive applications and libraries even more with distributed task execution and incremental builds.

### Scaling your organization

- **Controlled Code Sharing** - You define libraries with specific enforced APIs and put rules in place to define how those libraries can depend on each other. Using `CODEOWNERS` can be used to restrict who is allowed to change files in each project.

- **Consistent Code Generation** - Generators allow you to automate code creation and modification tasks. Instead of writing a 7 step guide in a readme file, you can create a generator to prompt the developer for inputs and modify the code directly. Nrwl provides plugins containing useful executors and generators for many popular tools. Also, Nx workspaces are extended further through a growing number of community-provided plugins.

- **Accurate Architecture Diagram** - Most architecture diagrams become obsolete in an instant. And every diagram becomes out of date as soon as the code changes. Because Nx understands your code, it generates an up-to-date and accurate diagram of how projects depend on each other. The Nx project dependencies are also pluggable to extend to other programming languages and ecosystems.
