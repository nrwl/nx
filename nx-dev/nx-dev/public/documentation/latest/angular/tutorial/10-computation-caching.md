# Angular Nx Tutorial - Step 10: Computation Caching

<iframe width="560" height="315" src="https://www.youtube.com/embed/HX3--ilBhBs" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

Nx has built-in computation caching, which helps drastically improve the performance of the commands.

**To see it in action, run `npx nx build todos`:**

```bash
> npx nx run todos:build
Generating ES5 bundles for differential loading...
ES5 bundle generation complete.

chunk {runtime} runtime-es2015.js, runtime-es2015.js.map (runtime) 6.16 kB [entry] [rendered]
chunk {runtime} runtime-es5.js, runtime-es5.js.map (runtime) 6.16 kB [entry] [rendered]
chunk {polyfills} polyfills-es2015.js, polyfills-es2015.js.map (polyfills) 141 kB [initial] [rendered]
chunk {main} main-es2015.js, main-es2015.js.map (main) 22.7 kB [initial] [rendered]
chunk {main} main-es5.js, main-es5.js.map (main) 24.1 kB [initial] [rendered]
chunk {styles} styles-es2015.js, styles-es2015.js.map (styles) 9.88 kB [initial] [rendered]
chunk {styles} styles-es5.js, styles-es5.js.map (styles) 11.1 kB [initial] [rendered]
chunk {polyfills-es5} polyfills-es5.js, polyfills-es5.js.map (polyfills-es5) 759 kB [initial] [rendered]
chunk {vendor} vendor-es2015.js, vendor-es2015.js.map (vendor) 2.35 MB [initial] [rendered]
chunk {vendor} vendor-es5.js, vendor-es5.js.map (vendor) 2.75 MB [initial] [rendered]
```

**Now, run `npx nx build todos` again, and you will see the results appearing instantly:**

```bash
> npx nx run todos:build

>  NX   NOTE  Cached Output:

Generating ES5 bundles for differential loading...
ES5 bundle generation complete.

chunk {polyfills-es5} polyfills-es5.js, polyfills-es5.js.map (polyfills-es5) 759 kB [initial] [rendered]
chunk {polyfills} polyfills-es2015.js, polyfills-es2015.js.map (polyfills) 141 kB [initial] [rendered]
chunk {main} main-es2015.js, main-es2015.js.map (main) 22.5 kB [initial] [rendered]
chunk {main} main-es5.js, main-es5.js.map (main) 23.9 kB [initial] [rendered]
chunk {vendor} vendor-es2015.js, vendor-es2015.js.map (vendor) 2.35 MB [initial] [rendered]
chunk {vendor} vendor-es5.js, vendor-es5.js.map (vendor) 2.75 MB [initial] [rendered]
chunk {styles} styles-es2015.js, styles-es2015.js.map (styles) 9.88 kB [initial] [rendered]
chunk {styles} styles-es5.js, styles-es5.js.map (styles) 11.1 kB [initial] [rendered]
chunk {runtime} runtime-es2015.js, runtime-es2015.js.map (runtime) 6.16 kB [entry] [rendered]
chunk {runtime} runtime-es5.js, runtime-es5.js.map (runtime) 6.16 kB [entry] [rendered]
```

Based on the state of the source code and the environment, Nx was able to figure out that it had already run this exact command. Nx found the artifact in the local cache and replayed the output and restored the necessary files.

> Caching only works with the Nx CLI. Running `ng build todos` runs the command every single time.

## Building multiple projects

**Now, run `npx nx run-many --target=build --projects=todos,api` to rebuild the two applications:**

```bash
Nx read the output from cache instead of running the command for 1 out of 2 projects.
```

Nx built `api` and retrieved `todos` from its computation cache. Read more about the cache here [here](/{{framework}}/core-extended/computation-caching).

## --with-deps

As we saw already, Nx is smart, so it knows how applications and libraries in the workspace depend on each other.

**Run `npx nx lint todos --with-deps`, and you see that Nx lints both the `todos` app and the libraries it depends on.**

```bash
>  NX  Running target lint for project todos and its 2 deps.

———————————————————————————————————————————————

> npx nx run todos:lint

Linting "todos"...

All files pass linting.


> npx nx run ui:lint

Linting "ui"...

All files pass linting.


> npx nx run data:lint

Linting "data"...

All files pass linting.


———————————————————————————————————————————————

>  NX   SUCCESS  Running target "lint" succeeded
```

> Add --parallel to any command, and Nx does most of the work in parallel.
