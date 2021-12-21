# Adding Nx to Lerna/Yarn/PNPM/NPM Workspace

If you have a monorepo that is powered by Lerna, Yarn, PNPM, or NPM, you can transform it into an Nx workspace by
running this command:

```bash
npx add-nx-to-monorepo
```

See it in action (3-minute video):

<iframe width="560" height="315" src="https://www.youtube.com/embed/Dq2ftPf3sn4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

`npx add-nx-to-monorepo` does the following:

1. Add Nx to your package.json.
2. Create `nx.json`, containing all the necessary configuration for Nx (
   see [Configuration](/{{framework}}/core-concepts/configuration#nx-json)).
3. Set up a `tsconfig` file mapping if needed.
4. Set up Nx Cloud (if you chose "yes").

> If you are familiar with Lerna or Yarn workspaces, check out [this guide](/{{framework}}/guides/lerna-and-nx) (with a 10-min video) showing how to add Nx to a Lerna/Yarn workspace, what the difference is, when to use both and when to use just Nx

> If you are familiar with Turborepo, check out [this guide](/{{framework}}/guides/turbo-and-nx). At this point, Nx can do anything Turbo can, and much more.

## What You Get Right Away

After you run the command above, you can run any npm script using Nx. For instance, if `myproj` has a `build` script,
you can invoke it using `npx nx build myproj`. If you pass any flags, they are forwarded to the underlying script.

### Parallelization and Task Invariants

Nx knows how your projects relate to each other. For instance, if Project A depends on Project B, Nx will build Project B first before building Project A.

When you run `npx nx build myproj`, Nx doesn't just build `myproj`, it first makes sure the results of building all `myproj`'s dependencies are in the right place. If the right files are in the right place, Nx will do nothing. If not, Nx will check if the right files are in its computation cache. If yes, Nx will restore them. If not, Nx will build the dependencies. In other words, Nx will use the faster way to get the context for building `myproj` ready.

Nx also knows which tasks can run in parallel and which tasks cannot be. Nx will parallelize the tasks without breaking any invariants. You can run `npx nx run-many --target=build --all` to build everything in parallel.

### Computation Caching

Nx supports computation caching. If it has seen the computation you are trying to perform, it's going extract the result
from its cache instead of running it. To see it in action, run the same command twice: `npx nx build myproj` and then
again `npx nx build myproj`. In addition to restoring all the files, Nx replays the terminal output as well, so you
don't lose any information when running a cached command.

Other tools performing computation caching (e.g., Turborepo) change the terminal output of the commands you run. They don't preserve animations and colors. We instrument Node.js to be able to capture terminal output as is. When running, say, an npm script via Nx, the output will not be modified. The same is true when Nx restores the output from cache.

### Distributed Caching

If you said "yes" to Nx Cloud, you can now clone the repo on a different machine such as your Continuous Integration(CI)
environment and run the same command against the same commit and the results are retrieved from cache. Never compute the
same thing twice in your org or CI.

### Distributed Task Execution

If you said "yes" to Nx Cloud, you can now update your CI to enable distributed task execution.

Imagine you are running `nx affected --build`. Normally this command runs the build target for the affected projects in parallel on the same machine. However, if you enable distributed task execution, the command will send the task graph to Nx Cloud. Nx Cloud agents will then pick up the tasks to execute them.

Note that this happens transparently. If an agent needs the output of `lib1` to build `app1`, and some agent built `lib11, the first agent is going to fetch the needed output before running the build task.

As agents complete tasks, the main job where you invoked nx affected `--build` will start receiving created files and terminal outputs. After nx affected `--build` completes, the machine will have the build files and all the terminal outputs as if it ran it locally.

[Learn more about configuring CI.](/{{framework}}/core-concepts/ci-overview)

### Affected Commands

Nx automatically analyzes your workspace to know what projects are affected by your commit. Simply
run: `npx nx affected --target=test` to see it in action. Often, Nx is able to do a better job detecting affected than
other tools because it looks not just at the changed files but also at the nature of the changes.

### Workspace Visualization

Run `npx nx dep-graph` to see a visualization of your workspace. `npx nx affected:dep-graph` shows what is affected by
your commit. `npx nx dep-graph --watch` watches your workspace for changes and updates the visualization.

<iframe width="560" height="315" src="https://www.youtube.com/embed/v87Y8NgAYLo" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allow="fullscreen"></iframe>

### GitHub integration

If you said "yes" to Nx Cloud, you can enable Nx Cloud - GitHub integration to get a much better overview of what
happens in your PRs.

![Nx Console screenshot](/shared/github.png)

### VS Code Plugin

![Nx Console screenshot](/shared/nx-console-screenshot.png)

## Next Steps

All this works without your having to change your repo in any way. Whatever setup you have still works the same way but
faster and with better dev ergonomics. But Nx enables much more than that.

Nx is like a VS Code of build tools. It has a very powerful core, but it's really the plugins and extra capabilities
that really transform how you develop.

Nx has first class support for React, Next.js, Gatsby, React Native, Angular, Node, NestJS, Jest, Cypress, Storybook and
many more. All the plugins are designed to work together and create a cohesive and pleasant to use dev environment.

In addition, Nx makes a lot of things much easier, like building large apps incrementally, distributing CI (no point in
doing caching unless you can do that), enforcing best practices, building design systems.

If you want to explore what it feels like to develop with Nx, check
out:

- [Getting Started](/{{framework}}/getting-started/intro)
- [Configuration](/{{framework}}/core-concepts/configuration)

## Troubleshooting

The `add-nx-to-monorepo` command does its best to figure out what projects you have in the repo, but you can exclude
them by adding the following to the `package.json` of the project.

```json
{
  "nx": {
    "ignore": true
  }
}
```

Nx can add a root tsconfig to your repo with something like this:

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

This tsconfig isn't used for building or testing. It's only used to teach Nx how to resolve imports, so Nx can do its
import source code analysis. If the path mappings are deduced incorrectly, feel free to change them.

## Real world examples of using add-nx-to-monorepo

### Speeding Up Remotion Monorepo with Nx

<iframe width="560" height="315" src="https://www.youtube.com/embed/TXySu4dZLp0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allow="fullscreen"></iframe>

### Speeding Up Storybook Monorepo with Nx

<iframe width="560" height="315" src="https://www.youtube.com/embed/3o8w6jbDr4A" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allow="fullscreen"></iframe>
