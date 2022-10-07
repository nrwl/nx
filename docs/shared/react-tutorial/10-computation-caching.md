# React Nx Tutorial - Step 10: Computation Caching

{% youtube
src="https://www.youtube.com/embed/aNjvT3VX1Ts"
title="Nx.dev Tutorial | React | step 10: Computation Caching"
width="100%" /%}

Nx has built-in computation caching, which helps drastically improve the performance of the commands.

**To see it in action, run `npx nx build todos`:**

```bash
> npx nx build todos

   ✔    1/1 dependent project tasks succeeded [0 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run todos:build:production

Entrypoint main 161 KiB = runtime.54e36ebee261465d.js 1.19 KiB main.ef46db3751d8e999.css 0 bytes main.01f6b36765a3989b.js 160 KiB
Entrypoint polyfills 93.5 KiB = runtime.54e36ebee261465d.js 1.19 KiB polyfills.bd0d0abec287a28e.js 92.3 KiB
Entrypoint styles 1.19 KiB = runtime.54e36ebee261465d.js 1.19 KiB styles.ef46db3751d8e999.css 0 bytes
chunk (runtime: runtime) main.ef46db3751d8e999.css, main.01f6b36765a3989b.js (main) 175 KiB (javascript) 152 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) polyfills.bd0d0abec287a28e.js (polyfills) 301 KiB [initial] [rendered]
chunk (runtime: runtime) styles.ef46db3751d8e999.css (styles) 50 bytes (javascript) 80 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) runtime.54e36ebee261465d.js (runtime) 3.23 KiB [entry] [rendered]
webpack compiled successfully (ff271a366051f1f6)

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project todos and 1 task(s) it depends on (5s)
```

{% callout type="note" title="The Nx Task Graph" %}
Note that our output mentions:

```bash
1/1 dependent project tasks succeeded
```

This is actually the `build` target of our `@myorg/data` project. It is a dependent taks because:

1. Our root `nx.json` file that was generated includes the following `targetDefaults`:

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

Note the usage of carot here in the `^build` value. This is used to signify that all project's `build` targets are dependent on the `build` target of all dependencies.

2. Our `@myorg/data` lib is a dependency of our application, and if we look at `libs/data/project.json`, we can see that it has a `build` target.
   (As you may recall, we used the `@nrwl/js:lib` generator to create this lib, which includes a `build` target by default.)

You can read more about [the mental model of Nx Task Graph](concepts/mental-model#the-task-graph), and [how to define your own Task Pipeline Connfiguration](concepts/task-pipeline-configuration).
{% /callout %}

**Now, run `npx nx build todos` again, and you see the results appearing instantly:**

```bash
% npx nx build todos

   ✔    1/1 dependent project tasks succeeded [1 read from cache]

   Hint: you can run the command with --verbose to see the full dependent project outputs

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————


> nx run todos:build:production  [existing outputs match the cache, left as is]

Entrypoint main 161 KiB = runtime.54e36ebee261465d.js 1.19 KiB main.ef46db3751d8e999.css 0 bytes main.01f6b36765a3989b.js 160 KiB
Entrypoint polyfills 93.5 KiB = runtime.54e36ebee261465d.js 1.19 KiB polyfills.bd0d0abec287a28e.js 92.3 KiB
Entrypoint styles 1.19 KiB = runtime.54e36ebee261465d.js 1.19 KiB styles.ef46db3751d8e999.css 0 bytes
chunk (runtime: runtime) main.ef46db3751d8e999.css, main.01f6b36765a3989b.js (main) 175 KiB (javascript) 152 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) polyfills.bd0d0abec287a28e.js (polyfills) 301 KiB [initial] [rendered]
chunk (runtime: runtime) styles.ef46db3751d8e999.css (styles) 50 bytes (javascript) 80 bytes (css/mini-extract) [initial] [rendered]
chunk (runtime: runtime) runtime.54e36ebee261465d.js (runtime) 3.23 KiB [entry] [rendered]
webpack compiled successfully (ff271a366051f1f6)

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project todos and 1 task(s) it depends on (38ms)

   Nx read the output from the cache instead of running the command for 2 out of 2 tasks.
```

Based on the state of the source code and the environment, Nx figured out that it had already run this exact command. Nx found the artifact in the local cache and replayed the output and restored the necessary files.

## Building multiple projects

**Now, run `npx nx run-many --target=build --projects=todos,api` to rebuild the two applications:**

```bash
> npx nx run-many --target=build --projects=todos,api

    ✔  nx run data:build  [existing outputs match the cache, left as is]
    ✔  nx run todos:build:production  [existing outputs match the cache, left as is]
    ✔  nx run api:build (3s)

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 2 projects and 1 task(s) they depend on (3s)

   Nx read the output from the cache instead of running the command for 2 out of 3 tasks.
```

Nx built `api` and retrieved `todos` and its dependent tasks from its computation cache. Read more about the cache [here](/concepts/how-caching-works).

> Add --parallel to any command, and Nx does most of the work in parallel.

## What's Next

- Continue to [Step 11: Test Affected Projects](/react-tutorial/11-test-affected-projects)
