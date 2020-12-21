## Why Monorepos?

A monorepo is a single git repository that holds the source code for multiple applications and libraries, along with the tooling for them.

### What are the benefits of a monorepo?

- **Shared code** - Keep your code DRY across your entire organization. Reuse validation code, UI components and types across the code base. Reuse code between the backend and the frontend.
- **Atomic changes** - Change a server API and modify the clients that consume that API in the same commit. You can change a button component in a shared library and the applications that use that component in the same commit. This saves the pain of trying to coordinate commits across multiple repositories.
- **Developer mobility** - Get a consistent way of building and testing applications written using different tools and technologies. Developers can confidently contribute to other teams’ applications and verify that their changes are safe.
- **Single set of dependencies** - Use a single version of third party dependencies for all your apps. Less frequently used applications don’t get left behind with a 3 year old version of a framework library or an old version of webpack.

## Why Not Code Collocation?

A naive implementation of a monorepo is simply code collocation - placing all the code from multiple repositories into the same repo without adequate tooling to coordinate everything. What problems arise from code collocation?

- **Running unnecessary tests** - In order to ensure nothing was broken by a change, all tests in the entire repository need to be run - even code in projects that are unrelated to the actual change.
- **No code boundaries** - A developer from another team can change code in your project, causing bugs or inconsistencies. Or worse, another team can use code that you intended for private use - forcing you to never change that code for fear of breaking their application.
- **Inconsistent tooling** - Each project uses its own set of commands for running tests, building, serving, etc. This makes it very difficult to move from project to project.

Tools like Lerna and Yarn Workspaces help optimize the installation of node modules, but they **do not** enable Monorepo-style development. In other words, they solve an orthogonal problem and sometimes can be used in combination with Nx. Read more on it [here](https://blog.nrwl.io/why-you-should-switch-from-lerna-to-nx-463bcaf6821).

## Nx Can Help

Nx provides tools to give you the benefits of a monorepo without the drawbacks of simple code collocation.

### Scaling Your Repo

- **Faster Command Execution** - Executors (or builders) allow for consistent commands to test, serve, build, lint, etc, each project. [Nx’s affected command]() helps run commands only on code that is affected by the current change. Nx provides local and distributed caching of executors so when someone on your team runs a command, everyone else will use their artifacts to speed up their own command executions, often bringing them down from minutes to seconds. This, in combination with support for distributed and incremental builds helps you scale your development to massive applications and repositories.

### Scaling Your Organization

- **Controlled Code Sharing** - You can define libraries with specific enforced APIs and put rules in place to define how those libraries can depend on each other. A CODEOWNERS file can be used to restrict who is allowed to change files in each project.
- **Consistent Code Generation** - Generators allow you to automate code creation and modification tasks. Instead of writing a 7 step guide in a readme file, you can create a generator to prompt the developer for inputs and then modify the code directly. Nrwl provides plugins which contain useful executors and generators for a lot of popular tools. Also, there is a growing number of community provided plugins.
- **Accurate Architecture Diagram** - Most architecture diagrams are wrong the moment they are written down. And every diagram becomes out of date as soon as the code changes. Since Nx understands your code, it can generate an up-to-date and accurate diagram of how projects depend on each other. And for cases where dependencies are not explicit in the code, you can manually tell Nx about project dependencies.
