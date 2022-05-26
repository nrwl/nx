# Integrating Nx and Lerna

> In case you missed it, Nrwl, the company behind Nx, [took over stewardship of Lerna](https://blog.nrwl.io/lerna-is-dead-long-live-lerna-61259f97dbd9). This opens up a range of new opportunities for integrating the two. Continue reading to learn more.

[Lerna](https://lerna.js.org/) is a popular JavaScript monorepo management tool and which can be used in combination with Nx. Lerna does three main things:

1. it runs commands for a single package or multiple packages (`lerna run`)
2. it manages dependencies (`lerna bootstrap`)
3. it publishes your packages, handles version management, and does changelog generation (`lerna publish`)

While Lerna is good at managing dependencies and publishing, it can quickly become painful to scale Lerna based monorepos, simply because Lerna is slow. That's where Nx shines and where it can really speed up your monorepo.

If you are about to setup a new monorepo from scratch, you can directly [go with Nx](/getting-started/nx-setup). If you have an existing Lerna monorepo, you can easily integrate the two.

For a discussion on #2, see [dependency management](#dependency-management) below. For a discussion on #3, see [version management](#version-Management--publishing) below.

## Speed up Lerna with Nx's powerful task scheduler

Nx comes with a powerful task scheduler that intelligenty runs operations and makes sure they are quick. This happens in a variety of ways:

- **Parallelization and task dependencies -** Nx automatically [knows how your projects relate to each other](/structure/dependency-graph). As a result, if `project-a` depends on `project-b` and you run the build command for `project-a`, Nx first runs the builds for all of `project-a`'s dependencies and then the invoked project itself. Nx sorts these tasks to maximize parallelism.
- **Only run what changed -** Using [Nx affected commands](/using-nx/affected) you only really execute tasks on the projects that changed, compared to a given baseline (usually the main branch).
- **Caching -** You get Nx's [computation caching](/using-nx/caching) for free. All operations, including artifacts and terminal output are restored from the cache (if present) in a completely transparent way without disrupting your DX. No configuration needed. Obviously this results in an incredible speed improvement.
- **Distributed Task Execution -** This is unique to Nx. In combination with Nx Cloud your tasks are automatically distributed across CI agents, taking into account build order, maximizing parallelization and thus agent utilization. It even learns from previous runs to better distribute tasks! [Learn more](/using-nx/dte)

## Integrating Nx with Lerna

Since the [Nx core team now also maintains Lerna](https://blog.nrwl.io/lerna-is-dead-long-live-lerna-61259f97dbd9), there are a lot of different possibilities for integrating the two. The main strategy is to keep using Lerna's bootstrapping and publishing features, but use Nx for the fast task scheduling to speed up Lerna workspaces.

There are two options:

- Upgrade to the latest Lerna version and enable Nx by adding the `useNx` flag to your `lerna.json` file without changing anything else (including your current Lerna commands)
- Directly using the Nx commands

### Use Nx for task scheduling, without changing the Lerna setup

Starting with Lerna 5.1 (currently in beta) you have Nx as an additional option to the existing `p-map` and `q-map` (previously used by Lerna) for running tasks. This is the **preferred approach if you have already a Lerna repository** since the impact is the lowest, while the benefit is still very high.

To enable Nx support (and thus speed up task running) go through the following steps:

**1. Install Nx**

```bash
npm i nx --save-dev
```

(or the yarn/pnpm alternatives).

**2. Adjust your lerna.json**

Change your `lerna.json` by adding the following flag.

```json
// lerna.json
{
  ...
  "useNx": true
}
```

By default `useNx` will be set to `false`, so you have to explicitly opt-in.

**3. Create a nx.json (optional but recommended)**

Nx works even without `nx.json` but to configure some more details such as the `cacheableOperations` of your monorepo in particular, create a `nx.json` at the root of the monorepo. Alternatively you can also just run `npx nx init` to have one generated. Specify the cacheable operations, usually something like `build`, `test`, `lint` etc, depending on your workspace setup:

```json
// nx.json
{
  "extends": "nx/presets/npm.json",
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build"]
      }
    }
  }
}
```

Having done these steps, you can now keep using your Lerna repository as you did before. All the commands will work in a backwards compatible way but will be a lot faster. [Read our blog post for some benchmarks](https://blog.nrwl.io/lerna-used-to-walk-now-it-can-fly-eab7a0fe7700?source=friends_link&sk=6c827ec7c9adfc1c760ff2e3f3e05cc7).

> Note, this does not include distributed caching or distributed task execution powered by Nx Cloud. But you can easily add support for it if wanted. All that's required is `npx nx connect-to-nx-cloud`.

### Switch to the Nx native commands in your Lerna workspace

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

Lerna has dependency management already built-in using `lerna bootstrap`. Running that will install all npm dependencies for all packages and also symlink together all Lerna packages that have dependencies of each other.

Nx does not handle dependency management. As a result, if you already have a Lerna workspace, you can safely keep using `lerna bootstrap`. Alternatively you can use some of the baked-in solutions that now come with npm/yarn/pnpm workspaces.

## Version Management & Publishing

Version management is defined as bumping the version of your changed monorepo packages and automatically creating a changelog. After bumping the version, you will commonly want to publish/upload the new version to NPM (or some other package repository).

If you have an existing Lerna monorepo, feel free to continue using `lerna publish`.

Right now Nx does not handle version management although you can use the [@jscutlery/semver](https://github.com/jscutlery/semver) Nx plugin.

You can also leverage a 3rd-party tool such as:

- [release-it](https://github.com/release-it/release-it) (standalone CLI tool)
- [changesets](https://github.com/changesets/changesets) (standalone CLI tool)

## What's more?

Nx comes with a whole range of additional features such as:

- **Interactive workspace visualization -** to interactively explore the underlying [project graph](/structure/dependency-graph) for understanding dependencies and find paths between nodes.
- **Nx plugins -** for adding first-class support for React, Next.js, React Native, Angular, Node, NestJS, Jest, Cypress, Storybook and many more.
- **Dedicated VSCode extension -** You can install [Nx Console](/using-nx/console) which is a dedicated VSCode extension to provide a visual interface for navigating your monorepo workspace in terms of launching commands as well as for generating code.
- **GitHub integration -** Install the [Nx Cloud Github App](https://github.com/apps/nx-cloud) to get inline reporting on your CI jobs.
- ...

But take your time to explore.
