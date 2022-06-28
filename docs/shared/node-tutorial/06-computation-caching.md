# Node Nx Tutorial - Step 6: Computation Caching

<iframe loading="lazy" width="560" height="315" src="https://www.youtube.com/embed/gXChzhI1Qpg" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>

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

## What's Next

- Continue to [Step 7: Test affected projects](/node-tutorial/07-test-affected-projects)
