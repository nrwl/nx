# Using Nx Core Without Plugins

The core of Nx is generic, simple, and unobtrusive. Nx plugins, although very useful for many projects, are completely
optional. Most large Nx workspaces use plugins for some things but not for others.

This guide will walk you through creating a simple Nx workspace with no plugins. It will help you see what capabilities
of Nx are completely generic and can be used with any technology or tool.

## Using Nx Core

### Creating a New Workspace

> this tutorial uses yarn workspaces, run `npm i -g yarn` to install yarn.

Running `yarn create nx-workspace myorg --preset=core` creates an empty workspace.

> You can say no to Nx Cloud

This is what is generated:

```treeview
myorg/
├── packages/
├── tools/
├── nx.json
├── workspace.json
├── package.json
└── tsconfig.base.json
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
    "@nrwl/tao": "13.4.4",
    "@nrwl/cli": "13.4.4",
    "@nrwl/workspace": "13.4.4",
    "@types/node": "14.14.33",
    "typescript": "~4.4.3"
  }
}
```

`nx.json` contains the Nx CLI configuration.

```json
{
  "extends": "@nrwl/workspace/presets/core.json",
  "npmScope": "myorg",
  "affected": {
    "defaultBase": "main"
  },
  "cli": {
    "defaultCollection": "@nrwl/workspace"
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/workspace/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  }
}
```

Finally, `workspace.json` lists the workspace projects, and since we have none, it is empty.

### Creating an NPM Package

Running `yarn nx g npm-package simple` results in:

```treeview
packages/
├── simple/
│   ├── index.js
│   ├── package.json
│   └── project.json
├──nx.json
├──workspace.json
├── package.json
└── tsconfig.base.json
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

// Placeholder: talk about project.json/workspace.json default now is using project.json

The change in `workspace.json` is the only thing required to make Nx aware of the `simple` package. As long as you
include the project in `workspace.json`, Nx will include that project source in its graph computation and source
code analysis. It will, for instance, analyze the project's source code, and it will know when it can reuse the
computation from the cache and when it has to recompute it from scratch.

### Creating Second NPM Package and Enabling Yarn Workspaces

Running `yarn nx g npm-package complex` results in:

```treeview
packages/
├── simple/
│   ├── index.js
│   ├── package.json
│   └── project.json
├── complex/
│   ├── index.js
│   ├── package.json
│   └── project.json
├── nx.json
├── workspace.json
├── package.json
└── tsconfig.base.json
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

// placeholder: this does not work? still get cannot find module '@myorg/simple',

```bash
> nx run complex:test --verbose
warning package.json: No license field
$ node index.js --verbose=true
node:internal/modules/cjs/loader:936
  throw err;
  ^

Error: Cannot find module '@myorg/simple'
Require stack:
- /Users/caleb/Sandbox/myorg/packages/complex/index.js
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:933:15)
    at Function.Module._load (node:internal/modules/cjs/loader:778:27)
    at Module.require (node:internal/modules/cjs/loader:1005:19)
    at require (node:internal/modules/cjs/helpers:102:18)
    at Object.<anonymous> (/Users/caleb/Sandbox/myorg/packages/complex/index.js:1:1)
    at Module._compile (node:internal/modules/cjs/loader:1101:14)
    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1153:10)
    at Module.load (node:internal/modules/cjs/loader:981:32)
    at Function.Module._load (node:internal/modules/cjs/loader:822:12)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:81:12) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/Users/caleb/Sandbox/myorg/packages/complex/index.js' ]
}
```

Finally, run `yarn`, then `yarn nx test complex` works now.

## Using Yarn/PNPM/Lerna

This example uses Yarn to connect the two packages. Most of the time, however, there are better ways to do it. The [React](/react/overview),
[Node](node/overview) and [Angular](angular/overview) plugins for Nx allow different projects in your workspace to import each other without having to maintain
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

// placeholder (should we have people make these projects so they can see more in the dep-graph and commands won't fail?)
Running `yarn nx run-many --target=build --projects=app1,app2` builds `proj1` and `proj2` and their
dependencies in parallel. Note that if `app1` depends on the output of its dependency (e.g., a `shared-components` library), Nx
will build the `shared-components` library first and only then build the app.

### Nx Knows What Is Affected

Running `yarn nx affected --target=test` will test all the projects affected by the current PR.

### Nx Caches and Distributes Tasks

Running `yarn nx build app1` caches the file artifacts and terminal output. When you run the command again, it will execute instantly because the results are retrieved from the cache. If you use [Nx Cloud](https://nx.app/), the cache is shared between you, your teammates, and the CI agents. Nx distribute tasks across multiple machines while preserving the developer experience of running on a single machine.

// placeholder: link to what DTE is?
This works because Nx's computation caching and distributed task execution work on the process level. It doesn't matter what `build` means. It can be an npm script, a custom Nx executor, a Gradle task. Nx will handle it in the same way.

## Adding Plugins

As you can see, the core of Nx is generic, simple, and unobtrusive. Nx Plugins are completely optional, but they level up your developer experience. The following video shows plugins in action.

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/BO1rwynFBLM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>
