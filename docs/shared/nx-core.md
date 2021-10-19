# Using Nx Core Without Plugins

The core of Nx is generic, simple, and unobtrusive. Nx Plugins, although very useful for many projects, are completely
optional. This guide will walk you through creating a simple Nx workspace with no plugins.

## Using Nx Core

### Creating a New Workspace

Running `yarn create nx-workspace --preset=npm` creates an empty workspace.

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
  "extends": "@nrwl/workspace/presets/npm.json",
  "npmScope": "myorg",
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

And `workspace.json` gets updated to:

```json
{
  "version": 2,
  "projects": {
    "simple": {
      "root": "packages/simple"
    }
  }
}
```

With this you can invoke any script defined in `simple/package.json` via Nx. For instance, you can invoke the `test`
script by running `yarn nx test simple`. And if you invoke this command a second time, the results are retrieved from
cache.

In this example, we used a generator to create the package, but you could also have created it by hand or have copied it
from another project.

The change in `workspace.json` is the only thing required to make Nx aware of the `simple` package. As long as you
include the project into `workspace.json`, Nx will include that project source into its graph computation and source
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

Now let's modify `packages/complex/index.js` to include `require('@myorg/simple')`. If you run `npx nx test complex`,
you will see an error saying that `@myorg/simple` cannot be resolved.

This is expected. Nx analyzes your source to enable computation caching, it knows what projects are affected by your PR,
but it **does not** change how your npm scripts run. Whatever tools you use in your npm scripts will run exactly as they
would without Nx. **Nx Core doesn't replace your tools and doesn't change how they work.**

To make it work add a dependency from `complex` to `simple` in `package.json`:

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

`npx nx test complex` works now.

## Non-JS Projects

In this example both projects use JavaScript, but we could have created, say, a Rust project instead. The only thing we
would have to do is to manually define targets.

This is an example of manually defining a target ([read more about it](/{{framework}}/workspace/run-commands-executor)):

```json
{
  "version": 2,
  "projects": {
    "simple": {
      "root": "packages/simple",
      "targets": {
        "test": {
          "executor": "@nrwl/workspace:run-commands",
          "options": {
            "command": "npm run test"
          }
        }
      }
    }
  }
}
```

## Using Yarn/PNPM/Lerna

The example uses Yarn to connect the two packages. Most of the time, however, there are better ways to do it. The React,
Node, Angular plugins for Nx allow different projects in your workspace to import each other without having to maintain
cumbersome `package.json` files. Instead, they use Webpack, Rollup and Jest plugins to enable this use case in a more
elegant way. [Read about the relationship between Nx and Yarn/Lerna/PNPM](/{{framework}}/guides/lerna-and-nx).

## What Nx Provides

If you run `npx nx dep-graph` you will see that `complex` has a dependency on `simple`. Any change to `simple` will
invalidate the computation cache for `complex`, but changes to `complex` won't invalidate the cache for `simple`.

In contrast to more basic JS monorepo tools, Nx doesn't just analyze `package.json` files. It does much more. Nx also
knows that adding a `require()` creates a dependency and that some dependencies cannot even be expressed in the source
code. This is crucial for the following reasons:

- Often, configuration files aren't packages. They aren't built and aren't published. Your packages can depend on them.
  Nx can recognize this dependency and take it into consideration for `affected:*` and cache computations.
- Many workspaces have non-JS projects, so you cannot define the deps between them and your JS projects
  using `package.json`.
- Aux packages (e.g., e2e tests or demo applications) aren't publishable. You could create fake `package.json` files for
  them, but with Nx you don't have to.
- You may have a de-facto dependency (where Project A depends on B without a dependency in `package.json`). This would
  break other monorepo tools because they would not know that changing B changes the behavior of A. This isn’t the case
  with Nx.

### Some Things You Can Do

- `npx nx run-many --target --test --all --parallel` tests all projects in parallel.
- `npx nx affected --target --test --all` tests all the projects affected by the current PR. To see this in action,
  check in all your changes, and create a new branch.

## Adding Plugins

As you can see, the core of Nx is generic, simple, and unobtrusive. Nx Plugins are completely optional, but they can
really level up your developer experience. Watch the video below to see Nx plugins in action.

[Read more about Nx plugins](/{{framework}}/core-concepts/nx-devkit).

## Adding Nx to Existing Workspaces

The following 10-min video walks you through the steps of adding Nx to a Lerna repo and showing many affordances Nx
offers. Although the video uses Lerna, everything said applies to Yarn Workspaces or PNPM. Basically, any time you
hear "Lerna" you can substitute it for Yarn or PNPM.

<iframe width="560" height="315" src="https://www.youtube.com/embed/BO1rwynFBLM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
