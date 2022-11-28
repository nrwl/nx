# React Tutorial - Part 4: Workspace Optimization

## Testing Affected Projects

`affected` is a mechanism that relies on your git metadata to determine the projects in your workspace that were affected by a given commit.

Run the command:

```shell
git add . && git commit -m "commiting to test affected"
```

Then make a change to the styles of your `routes-cart` project:

```css {% fileName="routes/cart/src/lib/routes-cart.module.css" %}
.container {
  color: blue;
}
```

You can visualize how our workspace is affected by this change using the command:

```shell
npx nx affected:graph
```

{% graph height="450px" %}

```json
{
  "hash": "85fd0561bd88f0bcd8703a9e9369592e2805f390d04982fb2401e700dc9ebc59",
  "projects": [
    {
      "name": "routes-cart",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "e2e",
      "type": "e2e",
      "data": {
        "tags": []
      }
    },
    {
      "name": "store",
      "type": "app",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "routes-cart": [
      { "source": "routes-cart", "target": "shared-ui", "type": "static" }
    ],
    "shared-ui": [],
    "e2e": [{ "source": "e2e", "target": "store", "type": "implicit" }],
    "store": [
      { "source": "store", "target": "routes-cart", "type": "static" },
      { "source": "store", "target": "shared-ui", "type": "static" }
    ]
  },
  "workspaceLayout": { "appsDir": "apps", "libsDir": "libs" },
  "affectedProjectIds": ["routes-cart", "store", "e2e"],
  "focus": null,
  "groupByFolder": false,
  "exclude": []
}
```

{% /graph %}

The change made to the `routes-cart` project is also affecting the `store` project. This can be leveraged to run tasks only on the projects that were affected by this commit.

To run the `test` targets only for affected projects, run the command:

```shell
npx nx affected --target=test
```

This can be particularly helpful in CI pipelines for larger repos, where most commits only affect a small subset of the entire workspace.

{% card title="Affected Documentation" description="Checkout Affected documentation for more details" url="/nx/affected" /%}

## Task Caching

`affected` allows you to "skip" tasks that couldn't possibly be affected by your changes. Task Caching allows you to "replay" tasks that have already been run.

Task Caching is informed by "inputs" and "outputs":

### Inputs

Inputs for your task caching includes by default any environment details and all the source code of the projects and dependencies affecting your project.

When running a task, Nx will determine all the inputs for your task and create a hash that will be used to index your cache. If you've already run this task with the same inputs, your cache will already be populated at this index, and Nx will replay the results stored in the cache.

If this index does not exist, Nx will run the command and if the command succeeds, it will store the result in the cache.

### Outputs

Outputs of the cache include the terminal output created by the task, as well as any files created by the task - for example: the artifact created by running a `build` task.

Outputs are defined for every target in your workspace:

```json {% fileName="libs/products/project.json" %}
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
      "outputs": ["{workspaceRoot}/coverage/libs/products"],
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

### Example

To see caching in action, run the command:

```{% command="npx nx build store" path="~/myorg" %}

   ✔    2/2 dependent project tasks succeeded [0 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 ————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run store:build:production


>  NX  Vite build starting ...

vite v3.2.4 building for production...
✓ 43 modules transformed.
dist/store/index.html                  0.46 KiB
dist/store/assets/index.50de2671.css   0.03 KiB / gzip: 0.05 KiB
dist/store/assets/index.f18c2b19.js    157.69 KiB / gzip: 51.26 KiB
dist/store/assets/index.f18c2b19.js.map 565.79 KiB

>  NX  Vite build finished ...


>  NX  Vite files available in dist/store


 ————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project store and 2 task(s) it depends on (6s)

```

Since you have not run the `build` target before for the `store` project, Nx runs the `build`, and populates the results in `dist/store` as specified in the `store` project's `project.json` file for the `build` target.

Next, remove your dist directory:

```shell
rm -rf dist
```

And run the command again:

```{% command="npx nx build admin" path="~/myorg" %}

   ✔    2/2 dependent project tasks succeeded [2 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run store:build:production  [local cache]


>  NX  Vite build starting ...

vite v3.2.4 building for production...
✓ 43 modules transformed.
dist/store/index.html                  0.46 KiB
dist/store/assets/index.50de2671.css   0.03 KiB / gzip: 0.05 KiB
dist/store/assets/index.f18c2b19.js    157.69 KiB / gzip: 51.26 KiB
dist/store/assets/index.f18c2b19.js.map 565.79 KiB

>  NX  Vite build finished ...


>  NX  Vite files available in dist/store


 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project store and 2 task(s) it depends on (42ms)

   Nx read the output from the cache instead of running the command for 3 out of 3 tasks.
```

Notice that `[local cache]` is mentioned in the terminal output, and that this time the command only took 42ms to run.

Also notice that the result of your build has been added back to the `dist/store` directory.

{% card title="More Task Caching Details" description="See the documentation for more information on caching." url="/core-features/cache-task-results" /%}

## Configuring Task Pipelines

Notice this line:

```text
   ✔    2/2 dependent project tasks succeeded [2 read from cache]
```

This is because your `store` project depends on the `routes-cart` and `shared-ui` projects, which also have `build` targets. By default Nx is configured to run the `build` target for any dependencies that have a `build` target, before running the `build` on the original project.

This feature allows the Nx graph to dynamically maintain task dependencies, rather than having to manually maintain those task dependencies as your workspace continues to grow.

{% card title="More On The Task Pipeline Configuration" description="See the Task Pipeline Configuration Guide for more details on how to configure your Task Graph." url="/concepts/task-pipeline-configuration" /%}

## What's Next

- Continue to [5: Summary](/react-standalone-tutorial/5-summary)
