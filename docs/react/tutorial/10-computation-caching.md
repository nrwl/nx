# Step 10: Computation Caching

Nx has built-in computation caching, which helps drastically improve the performance of the commands.

**To see it in action, run `nx build todos`:**

```bash
> nx run todos:build

Starting type checking service...
Using 14 workers with 2048MB memory limit
Hash: c38fbdb8b372af447180
Built at: 03/26/2020 11:03:57 AM
Entrypoint main = runtime.ff0534391bf88384547e.js main.b8dbcd3d3fd2900377f2.esm.js
Entrypoint polyfills = runtime.ff0534391bf88384547e.js polyfills.55535a35b1529d884ca3.esm.js
Entrypoint styles = runtime.ff0534391bf88384547e.js styles.3ff695c00d717f2d2a11.css
chunk    {0} runtime.ff0534391bf88384547e.js (runtime) 0 bytes ={1}= ={2}= ={3}= [entry] [rendered]
chunk    {1} main.b8dbcd3d3fd2900377f2.esm.js (main) 155 KiB ={0}= [initial] [rendered]
chunk    {2} polyfills.55535a35b1529d884ca3.esm.js (polyfills) 239 KiB ={0}= [initial] [rendered]
chunk    {3} styles.3ff695c00d717f2d2a11.css (styles) 147 bytes ={0}= [initial] [rendered]
```

**Now, run `nx build todos` again, and you will see the results appearing instantly:**

```bash
> nx run todos:build

>  NX   NOTE  Cached Output:

Starting type checking service...
Using 14 workers with 2048MB memory limit
Hash: c38fbdb8b372af447180
Built at: 03/26/2020 11:05:06 AM
Entrypoint main = runtime.ff0534391bf88384547e.js main.b8dbcd3d3fd2900377f2.esm.js
Entrypoint polyfills = runtime.ff0534391bf88384547e.js polyfills.55535a35b1529d884ca3.esm.js
Entrypoint styles = runtime.ff0534391bf88384547e.js styles.3ff695c00d717f2d2a11.css
chunk    {0} runtime.ff0534391bf88384547e.js (runtime) 0 bytes ={1}= ={2}= ={3}= [entry] [rendered]
chunk    {1} main.b8dbcd3d3fd2900377f2.esm.js (main) 155 KiB ={0}= [initial] [rendered]
chunk    {2} polyfills.55535a35b1529d884ca3.esm.js (polyfills) 239 KiB ={0}= [initial] [rendered]
chunk    {3} styles.3ff695c00d717f2d2a11.css (styles) 147 bytes ={0}= [initial] [rendered]
```

Based on the state of the source code and the environment, Nx was able to figure out that it had already run this exact command. Nx found the artifact in the local cache and replayed the output and restored the necessary files.

## Building Multiple Projects

**Now, run `nx run-many --target=build --projects=todos,api` to rebuild the two applications:**

```bash
Nx read the output from cache instead of running the command for 1 out of 2 projects.
```

Nx built `api` and retrieved `todos` from its computation cache. Read more about the cache [here](/{{framework}}/workspace/computation-caching).

## --with-deps

As we saw already, Nx is smart, so it knows how applications and libraries in the workspace depend on each other.

**Run `nx lint todos --with-deps`, and you see that Nx lints both the `todos` app and the libraries it depends on.**

```bash
>  NX  Running target lint for project todos and its 2 deps.

———————————————————————————————————————————————

> nx run todos:lint

Linting "todos"...

All files pass linting.


> nx run ui:lint

Linting "ui"...

All files pass linting.


> nx run data:lint

Linting "data"...

All files pass linting.


———————————————————————————————————————————————

>  NX   SUCCESS  Running target "lint" succeeded
```

> Add --parallel to any command, and Nx will do most of the work in parallel.

!!!!!
Run `nx lint api --with-deps`. What do you see?
!!!!!
Nx read the output from cache instead of running the command for 1 out of 2 projects.
Everything was retrieved from the cache
`Cannot lint data` error
