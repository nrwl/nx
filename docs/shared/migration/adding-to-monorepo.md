# Adding Nx to Lerna/Yarn/PNPM/NPM Workspace

> Interested in migrating from [Lerna](https://github.com/lerna/lerna) in particular? In case you missed it, Nrwl, the company behind Nx, [took over stewardship of Lerna](https://blog.nrwl.io/lerna-is-dead-long-live-lerna-61259f97dbd9). This allows for a much better integration between the two. [Read more in our dedicated guide](/guides/lerna-and-nx).

**Short story:** you can use Nx easily together with your current Lerna/Yarn/PNPM/NPM monorepo setup. Why? To speed up your tasks by leveraging Nx's powerful scheduling and caching capabilities.

Adding Nx is a low impact operation that does not require any particular change to your repository like how your packages and scripts are organized. Whatever setup you have still works the same way but faster and with better dev ergonomics. You could manually configure Nx, but it is way easier by running the following command:

```bash
npx add-nx-to-monorepo
```

Here's a short video walking you through the steps of adding Nx to a Lerna & Yarn workspaces based monorepo:

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/hCm373Aq1uQ" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

`npx add-nx-to-monorepo` does the following:

1. Add Nx to your package.json.
2. Create `nx.json`, containing all the necessary configuration for Nx.
3. Set up [Nx Cloud](https://nx.app) (if you chose "yes").

> If you are familiar with Turborepo, check out [this guide](/guides/turbo-and-nx). At this point, Nx can do anything Turbo can, and much more.

## What You Get Right Away

This sets up [Nx core](/getting-started/nx-core) in your existing monorepo which comes with a series of interesting features that help intelligenty schedule tasks and make sure operations are quick:

- **Run any npm script -** with Nx installed, you can use it's powerful task scheduler which automatically picks up your npm scripts from your package's script section. For instance if package `myproj` has a `build` script, you can just run it using `nx build myproj`. Similarly for running tests use `nx test myproj` and so on.
- **Parallelization and task dependencies -** Nx automatically [knows how your projects relate to each other](/structure/dependency-graph). As a result, if `project-a` depends on `project-b` and you run `nx build project-a`, Nx first runs the builds for all of `project-a`'s dependencies, in this specific example it builds `project-b` before `project-a`.
- **Only run what changed -** Using [Nx affected commands](/using-nx/affected) you only really execute tasks on the projects that changed, compared to a given baseline (usually the main branch).
- **Caching -** You get Nx's [computation caching](/using-nx/caching) for free. All operations, including artifacts and terminal output are restored from the cache (if present) in a completely transparent way without disrupting your DX. No configuration needed. Obviously this results in an incredible speed improvement.
- **Distributed Task Execution -** This is unique to Nx. In combination with Nx Cloud your tasks are automatically distributed across CI agents, taking into account build order, maximizing parallelization and thus agent utilization. It even learns from previous runs to better distribute tasks! [Learn more](/using-nx/dte)
- **Interactive workspace visualization -** Nx comes with a [project graph visualization](/structure/dependency-graph) built-in which you can use to interactively explore your workspace, understand dependencies and find paths between nodes and why they exist.
- **Dedicated VSCode extension -** You can install [Nx Console](/using-nx/console) which is a dedicated VSCode extension to provide a visual interface for navigating your monorepo workspace in terms of launching commands as well as for generating code.
- **GitHub integration -** Install the [Nx Cloud Github App](https://github.com/apps/nx-cloud) to get inline reporting on your CI jobs.

## Looking for integrating Lerna and Nx?

Check out our dedicated guide: [Lerna and Nx](/guides/lerna-and-nx)

## Further customizations

Here are some further customizations we found to be useful when adding Nx to existing monorepos.

### Excluding Sources

The `add-nx-to-monorepo` command does its best to figure out what projects you have in the repo. Similar to other tools, it looks at the `workspaces` property in the root `package.json` and tries to find all `package.json` files matching the globs. You can change those globs to exclude some projects. You can also exclude files by creating an `.nxignore` file, like this:

```text
third_party # nx will ignore everything in the third-party dir
```

### Enabling JS Analysis

The `add-nx-to-monorepo` command adds the following to the generated `nx.json`. This disables JS analysis, such that Nx only analyzes `package.json` files like Lerna or Turborepo.

```json
{
  "pluginsConfig": {
    "@nrwl/js": {
      "analyzeSourceFiles": false
    }
  }
}
```

We do this because most existing Lerna monorepos have implicit dependencies between projects Lerna knows nothing about. By adding `"analyzeSourceFiles": false` we are trying to make sure that Nx sees the same project graph Lerna does, even though the graph is often incorrect.

You can remove the section in the config, which will enable the JS/TS analysis. In this case Nx will consider all import and require statements in your JS/TS files when creating its project graph. If you do that, you can also add the `paths` property to the root `tsconfig.base.json` (if you don't have this file, create it), which will tell Nx how to resolve imports.

```json
{
  "compilerOptions": {
    "paths": {
      "one": ["packages/one/index"],
      "one/*": ["packages/one/*"],
      "two": ["packages/two/index"],
      "two/*": ["packages/two/*"]
    }
  }
}
```

## Next Steps

Nx is like a VS Code of build tools. It has a very powerful core, but it's really the plugins and extra capabilities that really transform how you develop.

Nx has first class support for React, Next.js, React Native, Angular, Node, NestJS, Jest, Cypress, Storybook and many more. All the plugins are designed to work together and create a cohesive and pleasant to use dev environment.

In addition, Nx makes a lot of things much easier, like building large apps incrementally, distributing CI (no point in doing caching unless you can do that), enforcing best practices, building design systems.

## Real world examples of using add-nx-to-monorepo

### Speeding Up Facebook React Monorepo with Nx

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/XLP2RAOwfLQ" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Speeding Up Remotion Monorepo with Nx

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/TXySu4dZLp0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allow="fullscreen"></iframe>

### Speeding Up Storybook Monorepo with Nx

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/3o8w6jbDr4A" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allow="fullscreen"></iframe>
