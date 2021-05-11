# Next Steps After Adding Nx to Monorepo

If you have a monorepo that is powered by Lerna, Yarn, PNPM, or NPM, you can transform it into an Nx workspace by
running this command: `npx add-nx-to-monorepo`.

See it in action (3-minute video):

<iframe width="560" height="315" src="https://www.youtube.com/embed/jkPeUFhH5h4" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

`npx add-nx-to-monorepo` will do the following:

1. Add Nx to your package.json
2. Create `workspace.json` and `nx.json` listing all the projects in the workspace
3. Set up a `tsconfig` file mapping all projects in there
4. Set up Nx Cloud (if you say "yes")

## What You Get Right Away

After you run the command above, you can any npm script using Nx. For instance, if `myproj` has a `build` script, you can invoke it using `npx nx build myproj`. If you pass any flags, they will be forwarded to the underlying script.

### Caching Works

Nx supports computation caching. If it has seen the computation you are trying to perform, it's going extract the result from its cache instead of running it. An easy way to see it in action is to run the same command
twice: `npx nx build myproj` and then again `npx nx build myproj`. In addition to restoring all the files, Nx will
replay the terminal output as well, so you don't lose any information when running a cached command.

### Distributed Caching Works

If you said "yes" to Nx Cloud, you can now clone the repo on a different machine (e.g., CI) and run the same command against the same commit and the results will be retrieved from cache. Never compute the same thing twice in your org or CI.

### Affected Works

Nx will automatically analyze your workspace to know what projects are affected by your commit. Simply run: `npx nx affected --target=test --base=main` to see it in action. Often, Nx is able to do a better job detecting
affected than other tools because it looks not just at the changed files but also at the nature of the changes.

### Workspace Visualization

Run `npx nx dep-graph` to see a visualization of your workspace. `npx nx affected:dep-graph` will show what is affected
by your commit.

<iframe width="560" height="315" src="https://www.youtube.com/embed/cMZ-ReC-jWU" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

### Github Integration Works

If you said "yes" to Nx Cloud, you can enable Nx Cloud - Github integration to get a much better overview of what
happens in your PRs.

![Nx Console screenshot](/shared/github.png)

### VS Code Plugin Works

![Nx Console screenshot](/shared/nx-console-screenshot.png)

## Next Steps

All this works without your having to change your repo in any way. Whatever setup you have still works the same way but
faster and with better dev ergonomics. But Nx enables much more than that.

Nx is like a VS Code of build tools. It has a very powerful core but it's really the plugins and extra capabilities that
really transform how you develop.

Nx has first class support for React, Next.js, Gatsby, React Native, Angular, Node, NestJS, Jest, Cypress, Storybook and
many more. All the plugins are designed to work together and create a cohesive and pleasant to use dev environment.

In addition, Nx makes a lot of things much easier, like building large apps incrementally, distributing CI (no point in doing caching unless you can do that), enforcing best practices, building design systems.

If you want to explore what it feels like to develop with Nx, check out:

- [nx.dev/react](https://nx.dev/react)
- [nx.dev/angular](https://nx.dev/angular)
- [nx.dev/node](https://nx.dev/node)

## Troubleshooting

The `add-nx-to-monorepo` command will do its best to figure out what projects you have in the repo, but you can always update the list yourself.

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

Nx will a root tsconfig with something like this:

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

This tsconfig isn't used for building or testing. It's only used to teach Nx how to resolve imports, so Nx can do its import source code analysis. If the path mappings are deduced incorrectly, feel free to chang them.
