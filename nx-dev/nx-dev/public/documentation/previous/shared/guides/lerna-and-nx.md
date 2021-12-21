# Nx and Yarn/Lerna (Workspaces for Publishing NPM Packages)

Nx has more in common with the build tools used at Google or Facebook (just made a lot more easily accessible for other companies) than with tools like Yarn Workspaces or Lerna. When using the word "monorepo" in the context of say Google, we imagine a much richer dev experience, not simply collocating a few projects side-by-side.

Lerna/Yarn/PNPM are package managers. When it comes to monorepos, they mainly perform `node_modules` deduping. So the choice isn't between Nx or Yarn Workspaces. It's between whether you want to have multiple `node_modules` folders (in this case use Nx with Yarn Workspaces) or not (use Nx without Yarn Workspaces).

In this guide we will look at setting up an Nx Workspaces for publishing NPM packages.

1. We will look at how to create a new workspace for publishing packages.
2. We will look at adding Nx to an existing workspace.

## New Workspace

Running `yarn create nx-workspace --preset=npm` creates an empty workspace set up to publish npm packages.

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

With this you can invoke any script defined in `simple/package.json` via Nx. For instance, you can invoke the `test` script by running `yarn nx test simple`. And if you invoke this command a second time, the results are retrieved from cache.

In this example, we used a generator to create the package, but you could also have created it by hand or have copied it from another project.

The change in `workspace.json` is the only thing required to make Nx aware of the `simple` package. As long as you include the project into `workspace.json`, Nx will include that project source into its graph computation and source code analysis. It will, for instance, analyze the project's source code, and it will know when it can reuse the computation from the cache and when it has to recompute it from scratch.

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

Now let's modify `packages/complex/index.js` to include `require('@myorg/simple')`. If you run `npx nx test complex`, you will see an error saying that `@myorg/simple` cannot be resolved.

This is expected. Nx analyzes your source to enable computation caching, it knows what projects are affected by your PR, but it **does not** change how your npm scripts run. Whatever tools you use in your npm scripts will run exactly as they would without Nx. **Nx doesn't replace your tools and doesn't change how they work.**

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

### What Nx Provides

If you run `npx nx dep-graph` you will see that `complex` has a dependency on `simple`. Any change to `simple` will invalidate the computation cache for `complex`, but changes to `complex` won't invalidate the cache for `simple`.

In contrast to more basic JS monorepo tools, Nx doesn't just analyze `package.json` files. It does much more. Nx also knows that adding a `require()` creates a dependency and that some dependencies cannot even be expressed in the source code. This is crucial for the following reasons:

- Often, configuration files aren't packages. They aren't built and aren't published. Your packages can depend on them. Nx can recognize this dependency and take it into consideration for `affected:*` and cache computations.
- Many workspaces have non-JS projects, so you cannot define the deps between them and your JS projects using `package.json`.
- Aux packages (e.g., e2e tests or demo applications) aren't publishable. You could create fake `package.json` files for them, but with Nx you don't have to.
- You may have a de-facto dependency (where Project A depends on B without a dependency in `package.json`). This would break other monorepo tools because they would not know that changing B changes the behavior of A. This isn’t the case with Nx.

### Some Things You Can Do

- `npx nx run-many --target --test --all --parallel` tests all projects in parallel.
- `npx nx affected --target --test --all` tests all the projects affected by the current PR. To see this in action, check in all your changes, and create a new branch.

### Adding Plugins

As you can see, the core of Nx is generic, simple, and unobtrusive. Nx Plugins are completely optional, but they can really level up your developer experience.

Unfortunately, the example we have here is too basic and won't benefit from using plugins, so please watch the video on Adding Nx to Existing Workspaces to see how you can transition from this core Nx workspace to a plugin-powered one.

## Adding Nx to Existing Workspaces

The following 10-min video walks you through the steps of adding Nx to a Lerna repo and showing many affordances Nx offers. Although the video uses Lerna, everything said applies to Yarn Workspaces or PNPM. Basically, any time you hear "Lerna" you can substitute it for Yarn or PNPM.

<iframe width="560" height="315" src="https://www.youtube.com/embed/BO1rwynFBLM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

## Clarifying Misconceptions

### Misconception: You have to choose between Nx and Yarn Workspaces/Lerna.

Lerna, Yarn workspaces, pnpm workspaces offer the following affordances for developing multiple projects in the same repo:

- Deduping node_modules. If I use the same version of say Next.js in all the projects, the package is installed once.
- Task orchestration. If I want to test all the projects, I can use a single command to do it.
- Publishing (Lerna only). I can run one command to publish packages to NPM.

This is what Nx offers:

- Smart rebuilds of affected projects
- Distributed task execution & computation caching
- Code sharing and ownership management
- High-quality editor plugins & GitHub apps
- Powerful code generators
- Workspace visualizations
- Rich plugin ecosystem
- Consistent dev experience for any framework
- Automatic upgrade to the latest versions of all frameworks and tools

As you can see, there is basically no overlap. Nx is notisn't a package manager nor does it (it's not a JS-only tool), so deduping `node_modules` isn't in that list. Nx doesn't care whether your repo has multiple node_modules folders or not, and whether you choose to dedupe them or not. In fact, many companies use Nx and yarn-workspaces together to get the benefits of both. If you want to use Yarn Workspaces to dedupe `node_modules` in your Nx workspace, you can do it. Many companies do.

What often happens though is when folks adopt Nx, they have better affordances for implementing a single-version policy (why this is a good idea is beyond the scope of this post, but you can read more about why Google does here). But it's important to stress that this isn't required by Nx. It's simply something that Nx can enable you to do at scale.

### Misconception: Nx is only for apps

If you do something well, folks assume that the only thing you can do. Nx is equally suited for publishable npm packages as it is for applications.

For instance, the Nx repo itself is built with Nx. It has 2 applications and a few dozen libraries. Those libraries are published to NPM.

Nx even has a `@nrwl/node` pluginAlthough it's true to say that the Nx core doesn't care whether you publish your packages or not, there are Nx plugins (e.g., `@nrwl/node`) that helps you bundle and package your modules for publishing.

For instance, the Nx repo itself is built with Nx. It has 2 applications and a few dozen libraries. Those libraries are published to NPM. Many larger organizations using Nx publish a subset of their libraries to their registry.

### Misconception: Nx is "all-in"

While Nx does have many plugins, each of them is optional. As you saw in the example above, Nx at its core is very minimal. Much like VS Code, Nx is very minimal but can easily be extended by adding plugins.Saying this is akin to saying that VS Code is "all in". The fullness and richness of the experience depends on how many plugins you choose to use. You could install a lot of Nx Plugins that will do a lot of the heavy lifting in, for instance, connecting your Next.js, Storybook and Cypress. You could but you don't have to.

As you saw in the example above, Nx core itself isn't more all-in than Yarn Workspaces is.

### Misconception: Nx is configuration over convention

As you saw in the example above and in the video, the amount of the generated configuration is small.

```
"simple": { "root": "packages/simple" }
```

After just one line, Nx automatically detects the npm scripts of your projects.That is it. If you have 200 projects in your workspace, you will see 200 lines specifying projects' roots. Practically everything else you see is optional. You can choose to configure your executors instead of using npm scripts, or configure generator defaults, and so forth. When you configure the `@nrwl/web:dev-server` executor, though, you aren't just adding a chunk of json config into `workspace.json`, you are also removing the configuration files you used to implement the same functionality (start scripts, Webpack config files etc.) So the total amount of configuration is decreasing, and, often, by a lot.

We came from Google, so we take the toolability very seriously. Nx plugins provide metadata to be understood by the Nx CLI and editors. The configuration of your workspace is also statically analyzable (in opposite to say the Webpack config files). In addition to enabling good VSCode and WebStorm support, it allows us to update your configuration automatically as you upgrade your version of Nx. Other than the toolability aspect we try to keep the config as short as possible and rely on conventions.
