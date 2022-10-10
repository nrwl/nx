# React Nx Tutorial - 4: Workspace Optimization

In this step of the tutorial, you will learn about the tools available to optimize your Nx Workspace.

## The Affected Command

`affected` is an Nx mechanism that relies on your git metadata to determine the projects in your Nx workspace that were affected by a given commit.

To see this in action, run the command:

```bash
git add . && git commit -m "commiting to test affected"
```

Then make a change to the styles of your `common-ui` project:

```css {% fileName="libs/common-ui/src/lib/common-ui.module.css" }
.container {
  color: 'blue;';
}
```

We can visualize how our workspace is affected by this change using the command:

```bash
npx nx affected:graph
```

![Nx Graph with Affected](/react-tutorial/nx-graph-with-affected.png)

{% callout type="note" title="Listing Affected Projects" %}
Printing out a list of affectected projects can also sometimes be helpful, especially for custom workflows. You can use the Nx `print-affected` command for this.

See the [Nx API documentation for `print-affected`](nx/print-affected) for full details.
{% /callout %}

Here we can see that the change we made to our `common-ui` project also affected the `admin` and `store` projects. We can leverage this fact to run commands against on the projects that were affected by this commit. For example to run the `test`s for the affected projects, run the command:

```bash
npx nx affected --target=test
```

This will run the `test` target for all projects that:

1. are affected by our change, and
2. have a `test` target in their `project.json` file.

This can be particularly helpful in CI pipelines for larger repos, where most commits only affect a small subset of the entire workspace.

{% callout type="note" title="Affected API Documentation" %}
See the [Nx API documentation for affected](nx/affected) for full details.
{% /callout %}

## Task Caching

Task Caching is another mechanism to optimize your workspace.

Whereas `affected` allows you to "skip" tasks that couldn't possibly be affected by your changes, Task Caching allows you to "replay" tasks that had already been run.

Also, while `affected` is informed by your git metadata, Task Caching is informed by "inputs" and "outputs":

### Inputs

Inputs for your task caching includes by default any environment details and all the source code of the projects and dependencies affecting your project.

When running a task, Nx will determine all the inputs for your project and create a hash that will be used to index your cache. If you've already run this task with the same inputs, your cache will already be populated for at this index, and Nx will replay the results stored in the cache.

If this index does not exist, Nx will actually run the command and then store those results in the cache.

### Outputs

Outputs of the cache include the terminal output craeted by the task, as well as any files created by the task - for example: the artifact created by running a `build` task.

Outputs are defined for every target in your workspace (this was also mentioned in our previous section on tasks):

```json {% filename="libs/products/project.json" %}
{
  "name": "products",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/products/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nrwl/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/products",
        "main": "libs/products/src/index.ts",
        "tsConfig": "libs/products/tsconfig.lib.json",
        "assets": ["libs/products/*.md"]
      }
    },
    "lint": {
      "executor": "@nrwl/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/products/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nrwl/jest:jest",
      "outputs": ["coverage/libs/products"],
      "options": {
        "jestConfig": "libs/products/jest.config.ts",
        "passWithNoTests": true
      }
    }
  },
  "tags": []
}
```

Outputs are stored in the cache so that terminal output can be replayed, and any created files can be pulled from your cache, and placed where they were created the original time the task was run.

{% callout type="note" title="Distributed Caching" %}
Without using Nx Cloud, your cache is only on your local filesystem (you can see it in your `node_modules/.cache` directory of your workspace).

However if you are using Nx Cloud, running tasks will also populate the centralized cache by sharing your runs with Nx Cloud. This can be particularly helpful for not duplicating tasks between you and your CI processes, as well as for caching tasks from other teammates.

You can read more about Nx Cloud in [the Nx Cloud introduction](/nx-cloud/intro/what-is-nx-cloud).
{% /callout %}

### Example

To see caching in action, run the command:

```bash
> npx nx build admin

> nx run admin:build:production

Entrypoint main 139 KiB = runtime.54e36ebee261465d.js 1.19 KiB main.623d91691bdb6754.css 42 bytes main.303fe7c1dcf5306b.js 137 KiB
Entrypoint polyfills 93.5 KiB = runtime.54e36ebee261465d.js 1.19 KiB polyfills.bd0d0abec287a28e.js 92.3 KiB
Entrypoint styles 1.19 KiB = runtime.54e36ebee261465d.js 1.19 KiB styles.ef46db3751d8e999.css 0 bytes
chunk (runtime: runtime) main.623d91691bdb6754.css, main.303fe7c1dcf5306b.js (main) 144 KiB (javascript) 50 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) polyfills.bd0d0abec287a28e.js (polyfills) 301 KiB [initial] [rendered]
chunk (runtime: runtime) styles.ef46db3751d8e999.css (styles) 50 bytes (javascript) 80 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) runtime.54e36ebee261465d.js (runtime) 3.23 KiB [entry] [rendered]
webpack compiled successfully (0c0df3e6c70c6b7b)

 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project admin (4s)
```

Since you had not run the `build` target before for the `admin` project, Nx ran the `build`, and populated the results in `dist/apps/admin` as specified in the `admin` project's `project.json` file for the `build` target, which we can see took 4 seconds.

Next, remove your dist directory:

```bash
rm -rf dist
```

And run the command again:

```bash
`npx nx build admin`

> nx run admin:build:production  [local cache]

Entrypoint main 139 KiB = runtime.54e36ebee261465d.js 1.19 KiB main.623d91691bdb6754.css 42 bytes main.303fe7c1dcf5306b.js 137 KiB
Entrypoint polyfills 93.5 KiB = runtime.54e36ebee261465d.js 1.19 KiB polyfills.bd0d0abec287a28e.js 92.3 KiB
Entrypoint styles 1.19 KiB = runtime.54e36ebee261465d.js 1.19 KiB styles.ef46db3751d8e999.css 0 bytes
chunk (runtime: runtime) main.623d91691bdb6754.css, main.303fe7c1dcf5306b.js (main) 144 KiB (javascript) 50 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) polyfills.bd0d0abec287a28e.js (polyfills) 301 KiB [initial] [rendered]
chunk (runtime: runtime) styles.ef46db3751d8e999.css (styles) 50 bytes (javascript) 80 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) runtime.54e36ebee261465d.js (runtime) 3.23 KiB [entry] [rendered]
webpack compiled successfully (0c0df3e6c70c6b7b)

 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project admin (59ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

Notice that the output is annotated to show that this task's result was cached in your `[local cache]`, and that this time the command only took 59ms to run.

{% callout type="note" title="More Cache Details" %}
See the [Core Features documentation page for Cache Task Results](/core-features/cache-task-results) for more information on caching.
{% /callout %}

## The Task Graph

Next, run the command `npx nx build store`:

```bash
> npx nx build store

   ✔    1/1 dependent project tasks succeeded [0 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run store:build:production

Entrypoint main 139 KiB = runtime.54e36ebee261465d.js 1.19 KiB main.623d91691bdb6754.css 42 bytes main.94f9a4a3cec4f056.js 138 KiB
Entrypoint polyfills 93.5 KiB = runtime.54e36ebee261465d.js 1.19 KiB polyfills.bd0d0abec287a28e.js 92.3 KiB
Entrypoint styles 1.19 KiB = runtime.54e36ebee261465d.js 1.19 KiB styles.ef46db3751d8e999.css 0 bytes
chunk (runtime: runtime) main.623d91691bdb6754.css, main.94f9a4a3cec4f056.js (main) 145 KiB (javascript) 50 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) polyfills.bd0d0abec287a28e.js (polyfills) 301 KiB [initial] [rendered]
chunk (runtime: runtime) styles.ef46db3751d8e999.css (styles) 50 bytes (javascript) 80 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) runtime.54e36ebee261465d.js (runtime) 3.23 KiB [entry] [rendered]
webpack compiled successfully (06e95dfdacea84c7)

 ———————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project store and 1 task(s) it depends on (5s)
```

Notice the line here:

```bash
   ✔    1/1 dependent project tasks succeeded [0 read from cache]
```

This is because your `store` project is dependent on your `products` project, which is also buildable. By default Nx is configured to run (or pull results from cache) for any dependent project's `build`s.

{% callout type="note" title="Customizing Task Inputs" %}
When you generated your workspace, those scripts set reasonable `targetDefaults` in your `nx.json` file.

See our [guide for Customizing Inputs and Named Inputs](/more-concepts/customizing-inputs) for more information on how to customize these to better fit your workspace.
{% /callout %}

This can be particularly helpful in relying on your Nx graph to dynamically maintain task dependencies, rather than having to manually maintain those task dependencies as your workspace continues to grow.

## What's Next

- Continue to [5: Summary](/react-tutorial/5-summary)
