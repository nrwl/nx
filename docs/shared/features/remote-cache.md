# Use Remote Caching (Nx Replay)

By default Nx [caches task computations locally](/features/cache-task-results). However, to benefit from the cache across your team and in particular on CI, the computation cache can also be distributed across multiple machines.

The **Nx Replay** feature of Nx Cloud is a fast, secure and zero-config implementation of remote caching.

![Diagram showing Teika sharing his cache with CI, Kimiko and James](/shared/images/dte/distributed-caching.svg)

In this diagram, Teika runs the build once on his machine, then CI, Kimiko and James can use the cached artifact from Teika instead of re-executing the same work.

## Setting Up Nx Cloud

To use **Nx Replay** you need to connect your workspace to Nx Cloud. See the [connect to Nx Cloud recipe](/ci/recipes/set-up/connect-to-cloud).

## See Remote Caching in Action

To see the remote cache in action, run:

```{% command="nx build header && nx reset && nx build header"%}
> nx run header:build

> header@0.0.0 build
> rimraf dist && rollup --config

src/index.tsx → dist...
created dist in 786ms

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project header (2s)

   See logs and investigate cache misses at https://cloud.nx.app/runs/k0HDHACpL8


 >  NX   Resetting the Nx workspace cache and stopping the Nx Daemon.

   This might take a few minutes.


 >  NX   Daemon Server - Stopped


 >  NX   Successfully reset the Nx workspace.


> nx run header:build  [remote cache]


> header@0.0.0 build
> rimraf dist && rollup --config


src/index.tsx → dist...
created dist in 786ms

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for project header (664ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.

   Nx Cloud made it possible to reuse header: https://nx.app/runs/P0X6ZGTkqZ
```

## Skipping Cloud Cache

Similar to how `--skip-nx-cache` will instruct Nx not to use the local cache, passing `--no-cloud` will tell Nx not to use the remote cache from Nx Cloud.
