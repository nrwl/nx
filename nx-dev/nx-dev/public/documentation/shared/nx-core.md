# Using Nx Core Without Plugins

The core of Nx is generic, simple, and unobtrusive. Nx plugins, although very useful for many projects, are completely
optional. Most large Nx workspaces use plugins for some things and don't use plugins for others.

This guide will walk you through creating a simple Nx workspace with no plugins. It will help you see what capabilities
of Nx are completely generic and can be used with any technology or tool.

## Using Nx Core

### Creating a New Workspace

Running `yarn create nx-workspace --preset=core` creates an empty workspace.

This is what is generated:

```text
packages/
nx.json
workspace.json
tsconfig.base.json
package.json
```

`package.json` contains Nx packages.

```json
{
  "name": "myorg",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {},
  "private": true,
  "devDependencies": {
    "@nrwl/cli": "12.8.0",
    "@nrwl/tao": "12.8.0",
    "@nrwl/workspace": "12.8.0",
    "@types/node": "14.14.33",
    "typescript": "~4.3.5"
  }
}
```

`nx.json` contains the Nx CLI configuration.

```json
{
  "extends": "@nrwl/workspace/presets/core.json",
  "npmScope": "myorg",
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/workspace/tasks-runners",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  }
}
```

Finally, `workspace.json` lists the workspace projects, and since we have none, it is empty.

### Creating an NPM Package

Running `nx g npm-package simple` results in:

```text
packages/
 simple/
   index.js
   package.json
nx.json
workspace.json
tsconfig.base.json
package.json
```

The generated `simple/package.json`:

```json
{
  "name": "@myorg/simple",
  "version": "1.0.0",
  "scripts": {
    "test": "node index.js"
  }
}
```

With this you can invoke any script defined in `packages/simple/package.json` via Nx. For instance, you can invoke the `test`
script by running `yarn nx test simple`. And if you invoke this command a second time, the results are retrieved from
cache.

In this example, we used a generator to create the package, but you could have also created it by hand or copied it
from another project.

The change in `workspace.json` is the only thing required to make Nx aware of the `simple` package. As long as you
include the project in `workspace.json`, Nx will include that project source in its graph computation and source
code analysis. It will, for instance, analyze the project's source code, and it will know when it can reuse the
computation from the cache and when it has to recompute it from scratch.

### Creating Second NPM Package and Enabling Yarn Workspaces

Running `nx g npm-package complex` results in:

```text
packages/
 simple/
   index.js
   package.json
 complex/
   index.js
   package.json
nx.json
workspace.json
tsconfig.base.json
package.json
```

Now let's modify `packages/complex/index.js` to include `require('@myorg/simple')`. If you run `yarn nx test complex`,
you will see an error saying that `@myorg/simple` cannot be resolved.

This is expected. Nx analyzes your source to enable computation caching, it knows what projects are affected by your PR,
but it **does not** change how your npm scripts run. Whatever tools you use in your npm scripts will run exactly as they
would without Nx. **Nx Core doesn't replace your tools and doesn't change how they work.**

To make it work, add a dependency from `complex` to `simple` in `packages/complex/package.json`:

```json
{
  "name": "@myorg/complex",
  "version": "1.0.0",
  "scripts": {
    "test": "node index.js"
  },
  "dependencies": {
    "@myorg/simple": "*"
  }
}
```

Then add the following to the root `package.json` (which enables Yarn Workspaces).

```json
{
  "workspaces": ["packages/*"]
}
```

Finally, run `yarn`.

`yarn nx test complex` works now.

## Using Yarn/PNPM/Lerna

This example uses Yarn to connect the two packages. Most of the time, however, there are better ways to do it. The React,
Node and Angular plugins for Nx allow different projects in your workspace to import each other without having to maintain
cumbersome `package.json` files. Instead, they use Webpack, Rollup and Jest plugins to enable this use case in a more
elegant way. [Read about the relationship between Nx and Yarn/Lerna/PNPM](/guides/lerna-and-nx).

## What Nx Core Provides

### Nx Understands How Your Workspace Is Structured

If you run `yarn nx dep-graph` you will see that `complex` has a dependency on `simple`. Any change to `simple` will
invalidate the computation cache for `complex`, but changes to `complex` won't invalidate the cache for `simple`.

In contrast to more basic monorepo tools, Nx doesn't just analyze `package.json` files. It does much more. Nx also knows
that adding a `require()` creates a dependency and that some dependencies cannot even be expressed in the source code.

### Nx Orchestrates Tasks

Running `yarn nx run-many --target=test --all` will test all projects in parallel.

Running `yarn nx run-many --target=build --projects=app1,app2` will build `proj1` and `proj2` and their
dependencies in parallel. Note that if `app1` depends on the output of its dependency (e.g., `shared-components`), Nx
will build `shared-components` first and only then will build the app.

### Nx Knows What Is Affected

Running `yarn nx affected --target=test` will test all the projects affected by the current PR.

### Nx Caches and Distributes Tasks

Running `yarn nx build app1` will cache the file artifacts and the terminal output, so if you run it again the command
will execute instantly because the results will be retrieved from cache. If you use `Nx Cloud` the cache will be shared
between you, your teammates, and the CI agents. Nx can also distribute tasks across multiple machines while preserving
the developer experience of running it on a single machine.

This works because Nx's computation caching and distributed task execution work on the process level. It doesn't matter
what `build` means. It can be an npm script, a custom Nx executor, a Gradle task. Nx will handle it in the same way.

## Adding Plugins

As you can see, the core of Nx is generic, simple, and unobtrusive. Nx Plugins are completely optional, but they can
really level up your developer experience. Watch this video to see the plugins in action.

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/BO1rwynFBLM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>
