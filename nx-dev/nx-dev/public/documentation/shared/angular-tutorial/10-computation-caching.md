# Angular Nx Tutorial - Step 10: Computation Caching

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/HX3--ilBhBs" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Nx has built-in computation caching, which helps drastically improve the performance of the commands.

**To see it in action, run `npx nx build todos`:**

```bash
❯ nx build todos

> nx run todos:build:production
✔ Browser application bundle generation complete.
✔ Copying assets complete.
✔ Index html generation complete.

Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.198853e72abe040f.js      | main          | 125.05 kB |                35.88 kB
polyfills.80c46001d98dd563.js | polyfills     |  36.21 kB |                11.49 kB
runtime.db95d73b9ee480c5.js   | runtime       |   1.04 kB |               599 bytes
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 162.30 kB |                47.96 kB

Build at: 2022-01-21T20:36:14.528Z - Hash: 795c96ce5e48a766 - Time: 11596ms

———————————————————————————————————————————————

>  NX   SUCCESS  Running target "build" succeeded
```

**Now, run `npx nx build todos` again, and you will see the results appearing instantly:**

```bash
❯ nx build todos

> nx run todos:build:production [existing outputs match the cache, left as is]

Initial Chunk Files           | Names         |  Raw Size | Estimated Transfer Size
main.198853e72abe040f.js      | main          | 125.05 kB |                35.88 kB
polyfills.80c46001d98dd563.js | polyfills     |  36.21 kB |                11.49 kB
runtime.db95d73b9ee480c5.js   | runtime       |   1.04 kB |               599 bytes
styles.ef46db3751d8e999.css   | styles        |   0 bytes |                       -

                              | Initial Total | 162.30 kB |                47.96 kB

Build at: 2022-01-21T20:36:14.528Z - Hash: 795c96ce5e48a766 - Time: 11596ms

———————————————————————————————————————————————

>  NX   SUCCESS  Running target "build" succeeded

  Nx read the output from cache instead of running the command for 1 out of 1 tasks.
```

Based on the state of the source code and the environment, Nx was able to figure out that it had already run this exact command. Nx found the artifact in the local cache and replayed the output and restored the necessary files.

> Caching only works with the Nx CLI. Running `ng build todos` runs the command every single time.

## Building multiple projects

Use the `run-many` command to rebuild the two applications:

```sh
npx nx run-many --target=build --projects=todos,api
```

And notice the output:

```bash
Nx read the output from the cache instead of running the command for 1 out of 2 tasks.
```

Nx built `api` and retrieved `todos` from its computation cache. Read more about the cache here [here](/using-nx/caching).

> Add --parallel to any command, and Nx does most of the work in parallel.

## What's Next

- Continue to [Step 11: Test Affected Projects](/angular-tutorial/11-test-affected-projects)
