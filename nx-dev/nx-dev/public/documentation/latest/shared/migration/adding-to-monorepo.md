# Adding Nx to Lerna/Yarn/PNPM Workspace

If you have a monorepo that is powered by Lerna, Yarn, PNPM, or NPM workpsaces, you can transform it into an Nx workspace by
running this command:

```bash
npx add-nx-to-monorepo
```

See it in action (3-minute video):

<iframe width="560" height="315" src="https://www.youtube.com/embed/jkPeUFhH5h4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

`npx add-nx-to-monorepo` does the following:

1. Add Nx to your package.json.
2. Create `workspace.json` and `nx.json` listing all the projects in the workspace.
3. Set up a `tsconfig` file mapping all projects in there.
4. Set up Nx Cloud (if you chose "yes").

> If you are familiar with Lerna or Yarn workspaces, check out [this guide](/{{framework}}/guides/lerna-and-nx) (with a 10-min video) showing how to add Nx to a Lerna/Yarn workspace, what the difference is, when to use both and when to use just Nx

## What You Get Right Away

After you run the command above, you can run any npm script using Nx. For instance, if `myproj` has a `build` script, you can invoke it using `npx nx build myproj`. If you pass any flags, they are forwarded to the underlying script.

### Computating Caching

Nx supports computation caching. If it has seen the computation you are trying to perform, it's going extract the result from its cache instead of running it. To see it in action, run the same command twice: `npx nx build myproj` and then again `npx nx build myproj`. In addition to restoring all the files, Nx replays the terminal output as well, so you don't lose any information when running a cached command.

### Distributed Caching

If you said "yes" to Nx Cloud, you can now clone the repo on a different machine such as your Continuous Integration(CI) environment and run the same command against the same commit and the results are retrieved from cache. Never compute the same thing twice in your org or CI.

### Affected Commands

Nx automatically analyzes your workspace to know what projects are affected by your commit. Simply run: `npx nx affected --target=test --base=main` to see it in action. Often, Nx is able to do a better job detecting affected than other tools because it looks not just at the changed files but also at the nature of the changes.

### Workspace Visualization

Run `npx nx dep-graph` to see a visualization of your workspace. `npx nx affected:dep-graph` shows what is affected
by your commit. `npx nx dep-graph --watch` watches your workspace for changes and updates the the visualization.

<iframe width="560" height="315" src="https://www.youtube.com/embed/cMZ-ReC-jWU" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### GitHub integration

If you said "yes" to Nx Cloud, you can enable Nx Cloud - GitHub integration to get a much better overview of what
happens in your PRs.

![Nx Console screenshot](/shared/github.png)

### VS Code Plugin

![Nx Console screenshot](/shared/nx-console-screenshot.png)

## Next Steps

All this works without your having to change your repo in any way. Whatever setup you have still works the same way but
faster and with better dev ergonomics. But Nx enables much more than that.

Nx is like a VS Code of build tools. It has a very powerful core, but it's really the plugins and extra capabilities that
really transform how you develop.

Nx has first class support for React, Next.js, Gatsby, React Native, Angular, Node, NestJS, Jest, Cypress, Storybook and
many more. All the plugins are designed to work together and create a cohesive and pleasant to use dev environment.

In addition, Nx makes a lot of things much easier, like building large apps incrementally, distributing CI (no point in doing caching unless you can do that), enforcing best practices, building design systems.

If you want to explore what it feels like to develop with Nx, check out:

- [nx.dev/react](https://nx.dev/react)
- [nx.dev/angular](https://nx.dev/angular)
- [nx.dev/node](https://nx.dev/node)

## Troubleshooting

The `add-nx-to-monorepo` command does its best to figure out what projects you have in the repo, but you can always update the list yourself.

For instance, you can add/remove/update projects in `workspace.json`.

```json
{
  "version": 2,
  "projects": {
    "one": { "root": "packages/one", "type": "library" },
    "two": { "root": "packages/two", "type": "library" }
  }
}
```

Nx adds a root tsconfig to your repo with something like this:

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

This tsconfig isn't used for building or testing. It's only used to teach Nx how to resolve imports, so Nx can do its import source code analysis. If the path mappings are deduced incorrectly, feel free to change them.

## Real world examples of using add-nx-to-monorepo

### Speeding Up Remotion Monorepo with Nx

<iframe width="560" height="315" src="https://www.youtube.com/embed/TXySu4dZLp0" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Speeding Up Storybook Monorepo with Nx

<iframe width="560" height="315" src="https://www.youtube.com/embed/3o8w6jbDr4A" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
