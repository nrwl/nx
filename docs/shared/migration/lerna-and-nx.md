# Integrating Nx and Lerna

> In case you missed it, Nrwl, the company behind Nx, [took over stewardship of Lerna](https://blog.nrwl.io/lerna-is-dead-long-live-lerna-61259f97dbd9). This opens up a range of new opportunities for integrating the two. Continue reading to learn more.

Lerna does three main things:

- managing dependencies (`lerna bootstrap`)
- running commands for a single or multiple packages (`lerna run`)
- publish your packages, including version management and changelog generation (`lerna publish`)

A common pain point with Lerna is when it comes to scaling monorepos. This is **where Nx shines**.

## Speed up Lerna with Nx's powerful task scheduler

Nx comes with a powerful task scheduler that intelligenty runs operations and makes sure they are quick. This happens in a variety of ways:

- **Parallelization and task dependencies -** Nx automatically [knows how your projects relate to each other](/structure/dependency-graph). As a result, if `project-a` depends on `project-b` and you run the build command for `project-a`, Nx first runs the builds for all of `project-a`'s dependencies and then the invoked project itself. Nx sorts these tasks to maximize parallelism.
- **Only run what changed -** Using [Nx affected commands](/using-nx/affected) you only really execute tasks on the projects that changed, compared to a given baseline (usually the main branch).
- **Caching -** You get Nx's [computaton caching](/using-nx/caching) for free. All operations, including artifacts and terminal output are restored from the cache (if present) in a completely transparent way without disrupting your DX. No configuration needed. Obviously this results in an incredible speed improvement.
- **Distributed Task Execution -** This is unique to Nx. In combination with Nx Cloud your tasks are automatically distributed across CI agents, taking into account build order, maximizing parallelization and thus agent utilization. It even learns from previous runs to better distribute tasks! [Learn more](/using-nx/dte)

## Add Nx to an existing Lerna monorepo

Nx can be added to an existing Lerna monorepo by running the following command:

```bash
npx add-nx-to-monorepo
```

This will

1. Add Nx to your package.json.
2. Create `nx.json`, containing all the necessary configuration for Nx.
3. Set up [Nx Cloud](https://nx.app) (if you chose "yes").

You can then run your package's npm scripts by simply invoking

```bash
nx <command> <package-name>
```

Hence, if package `myproj` has a `build` script, you can just run it using `nx build myproj`. Similarly for running tests use `nx test myproj` and so on.

Here's an overview of some more Lerna commands and the corresponding Nx version:

```diff
{
  "private": true,
  "scripts": {
-   "build:all": "lerna run build",
+   "build:all": "nx run-many --target=build --all",
-   "build:app1": "lerna run build --scope=app1",
+   "build:app1": "nx build app1",
-   "build:since": "lerna run build --since=main",
+   "build:since": "nx affected --target=build",
-   "test:all": "lerna run test",
+   "test:all": "nx run-many --target=test --all",
-   "test:app1": "lerna run test --scope=app1",
+   "test:app1": "nx test app1",
-   "test:since": "lerna run test --since=main",
+   "test:since": "nx affected --target=test",
-   "dev": "lerna run dev --stream --parallel",
+   "dev": "nx run-many --target=dev --all",
-   "dev:app1": "lerna run dev --stream --scope=app1",
+   "dev:app1": "nx dev app1"
  },
  "devDependencies": {
    "lerna": "3.*",
+   "nx": "latest"
  }
}
```

[Learn more about the Nx CLI.](/using-nx/nx-cli)

## Dependency Management

Nx does not handle dependency management. You can continue using `lerna bootstrap` if that suits your needs or switch to newer options such as using built-in features of Yarn/NPM/PNPM workspaces.

## Publishing

Lerna has an integrated publishing process with version management and changelog generation. Nx doesn't handle publishing, quite contrary. The Nx repository itself uses Lerna for the package publishing process. So feel free to coninue using it!

That said, you can also easily integrate other tools such as [changesets](https://github.com/changesets/changesets) or [release-it](https://github.com/release-it/release-it) (just to mention two).

## What's more?

Nx comes with a whole range of additional features such as:

- **Interactive workspace visualization -** to interactively explore the underlying [project graph](/structure/dependency-graph) for understanding dependencies and find paths between nodes.
- **Nx plugins -** for adding first-class support for React, Next.js, React Native, Angular, Node, NestJS, Jest, Cypress, Storybook and many more.
- **Dedicated VSCode extension -** You can install [Nx Console](/using-nx/console) which is a dedicated VSCode extension to provide a visual interface for navigating your monorepo workspace in terms of launching commands as well as for generating code.
- **GitHub integration -** Install the [Nx Cloud Github App](https://github.com/apps/nx-cloud) to get inline reporting on your CI jobs.
- ...

But take your time to explore.
