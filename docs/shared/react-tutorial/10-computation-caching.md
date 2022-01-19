# React Nx Tutorial - Step 10: Computation Caching

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/aNjvT3VX1Ts" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

Nx has built-in computation caching, which helps drastically improve the performance of the commands.

**To see it in action, run `npx nx build todos`:**

```bash
> npx nx run todos:build

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

**Now, run `npx nx build todos` again, and you see the results appearing instantly:**

```bash
> npx nx run todos:build

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

Based on the state of the source code and the environment, Nx figured out that it had already run this exact command. Nx found the artifact in the local cache and replayed the output and restored the necessary files.

## Building multiple projects

**Now, run `npx nx run-many --target=build --projects=todos,api` to rebuild the two applications:**

```bash
Nx read the output from the cache instead of running the command for 1 out of 2 projects.
```

Nx built `api` and retrieved `todos` from its computation cache. Read more about the cache [here](/using-nx/caching).

> Add --parallel to any command, and Nx does most of the work in parallel.
