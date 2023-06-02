# Angular Monorepo Tutorial - Part 4: Workspace Optimization

## Testing Affected Projects

`affected` is a mechanism that relies on your git metadata to determine the projects in your workspace that were affected by a given commit.

Run the command:

```shell
git add . ; git commit -m "commiting to test affected"
```

Then make a change to the styles of your `common-ui` project:

```css {% fileName="libs/common-ui/src/lib/banner/banner.component.css" %}
header {
  color: 'blue;';
}
```

You can visualize how our workspace is affected by this change using the command:

```shell
npx nx affected:graph
```

![Project Graph with Affected](/shared/angular-tutorial/project-graph-with-affected.png)

The change made to the `common-ui` project is also affecting the `admin` and `store` projects. This can be leveraged run tasks only on the projects that were affected by this commit.

To run the `test` targets only for affected projects, run the command:

```shell
npx nx affected -t test
```

This can be particularly helpful in CI pipelines for larger repos, where most commits only affect a small subset of the entire workspace.

{% card title="Affected Documentation" description="Checkout Affected documentation for more details" url="/packages/nx/documents/affected" /%}

{% callout type="warning" title="Not too fast!" %}
Running this at this stage may result in some runtime errors being logged to the terminal.
The apps that use `<myorg-banner></myorg-banner>` wil need to have the `TestBed.configureTestingModule` in their `app.component.spec.ts` file updated to import `CommonUiModule`.
{% /callout %}

## Task Caching

`affected` allows you to "skip" tasks that couldn't possibly be affected by your changes. Task Caching allows you to "replay" tasks that have already been run.

Task Caching is informed by "inputs" and "outputs":

### Inputs

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
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/products",
        "main": "libs/products/src/index.ts",
        "tsConfig": "libs/products/tsconfig.lib.json",
        "assets": ["libs/products/*.md"]
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "lintFilePatterns": ["libs/products/**/*.ts"]
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
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

```{% command="npx nx build admin" path="~/myorg" %}

> nx run admin:build:production

✔ Browser application bundle generation complete.
✔ Copying assets complete.
✔ Index html generation complete.

Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.b937601e1488b89e.js      | main          |  86.65 kB |                25.97 kB
polyfills.0b28149b40699473.js | polyfills     |  33.04 kB |                10.61 kB
runtime.f826166b3c370f7e.js   | runtime       | 888 bytes |               512 bytes
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 120.55 kB |                37.08 kB

Build at: 2022-11-23T22:51:54.223Z - Hash: c67a92dd8266dfbe - Time: 7877ms

 ————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project admin (11s)
```

Since you have not run the `build` target before for the `admin` project, Nx runs the `build`, and populates the results in `dist/apps/admin` as specified in the `admin` project's `project.json` file for the `build` target.

Next, remove your dist directory:

```shell
rm -rf dist
```

And run the command again:

```{% command="npx nx build admin" path="~/myorg" %}

> nx run admin:build:production  [local cache]


Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.b937601e1488b89e.js      | main          |  86.65 kB |                25.97 kB
polyfills.0b28149b40699473.js | polyfills     |  33.04 kB |                10.61 kB
runtime.f826166b3c370f7e.js   | runtime       | 888 bytes |               512 bytes
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 120.55 kB |                37.08 kB

Build at: 2022-11-23T22:51:54.223Z - Hash: c67a92dd8266dfbe - Time: 7877ms

 ————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project admin (37ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
```

Notice that `[local cache]` is mentioned in the terminal output, and that this time the command only took 59ms to run.

Also notice that the result of your build has been added back to the `dist/apps/admin` directory.

{% card title="More Task Caching Details" description="See the documentation for more information on caching." url="/core-features/cache-task-results" /%}

## Configuring Task Pipelines

Next, run the command `npx nx build store`:

```{% command="npx nx build store" path="~/myorg" %}

   ✔    1/1 dependent project tasks succeeded [0 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 ————————————————————————————————————————————————————————————————————————————————————————————————


> nx run store:build:production

✔ Browser application bundle generation complete.
✔ Copying assets complete.
✔ Index html generation complete.

Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.5995a14e3c34a711.js      | main          | 101.39 kB |                29.83 kB
polyfills.19459ef8805e51da.js | polyfills     |  33.04 kB |                10.64 kB
runtime.5d40e95cc0c0e0d1.js   | runtime       | 888 bytes |               512 bytes
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 135.29 kB |                40.97 kB

Build at: 2022-11-23T22:53:29.097Z - Hash: 3cd478c78ebeead2 - Time: 5154ms

 ————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project store and 1 task(s) they depend on (8s)
```

Notice the line here:

```text
   ✔    1/1 dependent project tasks succeeded [0 read from cache]
```

This is because your `store` project depends on your `products` project, which also has a `build` target. By default Nx is configured to run the `build` target for any dependencies that have a `build` target, before running the `build` on the original project.

This feature allows the Nx graph to dynamically maintain task dependencies, rather than having to manually maintain those task dependencies as your workspace continues to grow.

{% card title="More On The Task Pipeline Configuration" description="See the Task Pipeline Configuration Guide for more details on how to configure your Task Graph." url="/concepts/task-pipeline-configuration" /%}

## What's Next

- Continue to [5: Summary](/angular-tutorial/5-summary)
