# Node Nx Tutorial - Step 6: Computation Caching

<iframe width="560" height="315" src="https://www.youtube.com/embed/gXChzhI1Qpg" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Nx has built-in computation caching, which drastically improves the performance of the commands.

**To see it in action, run `nx build todos`:**

```bash
> nx run todos:build
Starting type checking service...
Using 14 workers with 2048MB memory limit
Hash: 51f23143c450a9f931a7
Built at: 09/04/2020 4:03:20 PM
Entrypoint main = main.js main.js.map
chunk {main} main.js, main.js.map (main) 4.17 KiB [entry] [rendered]
```

**Now, run `nx build todos` again, and you will see the results appearing instantly:**

```bash
> nx run todos:build

>  NX   NOTE  Cached Output:

Starting type checking service...
Using 14 workers with 2048MB memory limit
Hash: 51f23143c450a9f931a7
Built at: 09/04/2020 4:03:20 PM
Entrypoint main = main.js main.js.map
chunk {main} main.js, main.js.map (main) 4.17 KiB [entry] [rendered]
```

Based on the state of the source code and the environment, Nx was able to figure out that it had already run this exact command. Nx found the artifact in the local cache and replayed the output and restored the necessary files.

## --with-deps

Nx is smart, so it knows how applications and libraries in the workspace depend on each other.

**Run `nx lint todos --with-deps`, and you see that Nx lints both the `todos` app and the libraries it depends on.**

```bash
>  NX  Running target lint for project todos and its 2 deps.

———————————————————————————————————————————————

> nx run data:lint

Linting "data"...

All files pass linting.


> nx run auth:lint

Linting "auth"...

All files pass linting.


> nx run todos:lint

Linting "todos"...

All files pass linting.


———————————————————————————————————————————————

>  NX   SUCCESS  Running target "lint" succeeded
```

> Add --parallel to any command, and Nx does most of the work in parallel.
