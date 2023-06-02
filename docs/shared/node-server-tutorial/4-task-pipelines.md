---
title: 'Node Server Tutorial - Part 4: Task Pipelines'
description: In this tutorial you'll create a backend-focused workspace with Nx.
---

# Node Server Tutorial - Part 4: Task Pipelines

## Running Dependent Tasks

Let's build the `products-api` application:

```{% command="npx nx build products-api" path="~/products-api" %}

   ✔    1/1 dependent project tasks succeeded [0 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run products-api:build:production

✔ Browser application bundle generation complete.
✔ Copying assets complete.
✔ Index html generation complete.

Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.dc68f58360ec52f7.js      | main          | 203.69 kB |                55.81 kB
polyfills.19459ef8805e51da.js | polyfills     |  33.04 kB |                10.64 kB
runtime.639feb9584ec9047.js   | runtime       |   2.62 kB |                 1.23 kB
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 239.35 kB |                67.68 kB

Lazy Chunk Files              | Names         |  Raw Size | Estimated Transfer Size
967.25ab9a0a8950995f.js       | store-cart    | 719 bytes |               395 bytes

Build at: 2022-11-30T16:44:43.171Z - Hash: 9850ece7cc7c6b7c - Time: 6527ms

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project products-api and 1 task(s) they depend on (9s)

```

Notice this line:

```shell
   ✔    1/1 dependent project tasks succeeded [0 read from cache]
```

When you run a task, Nx will run all the task's dependencies before running the task you specified. This ensures all the needed artifacts are in place before the task is run.

## Configuring Task Pipelines

Nx can infer how projects depend on each other by examining the source code, but Nx doesn't know which tasks depend on each other.

In the `nx.json` file you can see the default set up:

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    }
  }
}
```

The `"dependsOn": ["^build"]` line says that every `build` task depends on the `build` tasks for its project dependencies. You can override the `dependsOn` setting for individual projects in the `project.json` files.

{% card title="More On The Task Pipeline Configuration" description="See the Task Pipeline Configuration Guide for more details on how to configure your Task Graph." url="/concepts/task-pipeline-configuration" /%}

## Skip Repeated Tasks

Why does Nx always run the dependent tasks? Doesn't that waste time repeating the same work?

It would, if Nx didn't have a robust caching mechanism to take care of that problem for you. Let's build the `products-api` app again.

```{% command="npx nx build products-api" path="~/products-api" %}

   ✔    1/1 dependent project tasks succeeded [1 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run store:build:production  [existing outputs match the cache, left as is]


Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.dc68f58360ec52f7.js      | main          | 203.69 kB |                55.81 kB
polyfills.19459ef8805e51da.js | polyfills     |  33.04 kB |                10.64 kB
runtime.639feb9584ec9047.js   | runtime       |   2.62 kB |                 1.23 kB
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 239.35 kB |                67.68 kB

Lazy Chunk Files              | Names         |  Raw Size | Estimated Transfer Size
967.25ab9a0a8950995f.js       | store-cart    | 719 bytes |               395 bytes

Build at: 2022-11-30T16:44:43.171Z - Hash: 9850ece7cc7c6b7c - Time: 6527ms

 ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project store and 1 task(s) they depend on (13ms)

   Nx read the output from the cache instead of running the command for 2 out of 2 tasks.
```

This time the build only took 13 ms. Also, if you delete the `dist` folder and run the command again, the build output will be recreated.

{% card title="More Task Caching Details" description="See the documentation for more information on caching." url="/core-features/cache-task-results" /%}

## Cache Inputs and Outputs

How does Nx know when to replace a cached task result? And how does Nx know what should be cached?

Nx determines if a project has been modified by looking at the task's defined `inputs`. And then when the task is completed, it caches the terminal output and all the defined file `outputs`.

### Inputs

When you run a task, Nx uses the inputs for your task to create a hash that is used as an index for the task results. If the task has already been run with the same inputs, Nx replays the results stored in the cache.

If this index does not exist, Nx runs the command and if the command succeeds, it stores the result in the cache.

{% card title="More On Customizing Inputs" description="See the Customizing Inputs Guide for more details on how to set inputs for your tasks." url="/concepts/task-pipeline-configuration" /%}

### Outputs

Outputs of the cache include the terminal output created by the task, as well as any files created by the task - for example: the artifact created by running a `build` task.

Here are the outputs defined for the `auth` project:

```json {% fileName="auth/project.json" %}
{
  "name": "auth",
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/auth"
      }
    },
    "lint": {
      "executor": "@nx/linter:eslint",
      "outputs": ["{options.outputFile}"],
      "options": {
        "outputFile": "dist/auth/lint-report.txt"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": {}
    }
  },
  "tags": []
}
```

Outputs are stored in the cache so that terminal output can be replayed, and any created files can be pulled from your cache, and placed where they were created the original time the task was run.

## Testing Affected Projects

Another way that Nx saves you from unnecessary work is the `affected` command. `affected` is a mechanism that relies on your git metadata to determine the projects in your workspace that were affected by a given commit.

Run the command:

```shell
git add . ; git commit -m "commiting to test affected"
```

Then make a change to an endpoint of your `products-api` project:

```ts {% fileName="src/main.ts" %}
import express from 'express';
import { doAuth } from '@products-api/auth';

const host = process.env.HOST ?? 'localhost';
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = express();

app.get('/', (req, res) => {
  res.send({ message: 'Hello modified API' });
});

app.post('/auth', (req, res) => {
  res.send(doAuth());
});

app.listen(port, host, () => {
  console.log(`[ ready ] http://${host}:${port}`);
});
```

You can visualize how our workspace is affected by this change using the command:

```shell
npx nx affected:graph
```

{% graph height="450px" jsonFile="shared/node-server-tutorial/affected-project-graph.json" %}
{% /graph %}

The change made to the `products-api` project is also affecting the `e2e` project. This can be leveraged to run tasks only on the projects that were affected by this commit.

To run the `lint` targets only for affected projects, run the command:

```shell
npx nx affected -t lint
```

This can be particularly helpful in CI pipelines for larger repos, where most commits only affect a small subset of the entire workspace.

{% card title="Affected Documentation" description="Checkout Affected documentation for more details" url="/packages/nx/documents/affected" /%}

## What's Next

- Continue to [5: Docker Target](/node-server-tutorial/5-docker-target)
