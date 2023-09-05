# Use Remote Caching

By default Nx [caches task computations locally](/core-features/cache-task-results). However, to benefit from the cache across your team and in particular on CI, the computation cache can also be distributed across multiple machines. Nx Cloud is an app that provides a fast and zero-config implementation of distributed caching. It's completely free for OSS projects and for most closed-sourced projects ([read more here](https://nx.app/pricing)).

![Diagram showing Teika sharing his cache with CI, Kimiko and James](/shared/images/dte/distributed-caching.svg)

In this diagram, Teika runs the build once on his machine, then CI, Kimiko and James can use the cached artifact from Teika instead of re-executing the same work.

## Connecting Your Workspace to Your Nx Cloud Account

You can connect your workspace to Nx Cloud by running:

```shell
npx nx connect-to-nx-cloud
```

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

## Claim your Nx Cloud Workspace

After you have enabled Nx Cloud in your workspace, you will see the following:

```plaintext
>  NX   NOTE  Nx Cloud has been enabled

  Your workspace is currently public. Anybody with code access
  can view the workspace on nx.app.

  You can connect the workspace to your Nx Cloud account at
  https://nx.app/orgs/workspace-setup?accessToken=N2Y3NzcyO...
  (You can do this later.)
```

Click on this link to associate the workspace with your Nx Cloud account. If you don't have an Nx Cloud account, you can
create one on the spot.

After you claim your workspace, you will be able to manage permissions, create access tokens, set up billing, and so
forth.

**You will also see an interactive tutorial helping you explore distributed caching and the Nx Cloud user interface.**

**If you lose this link, you can still connect your workspace to Nx Cloud**. Go to [nx.app](https://nx.app), create an account, and connect your workspace using the access token from `nx.json`.

## Skipping Cloud Cache

Similar to how `--skip-nx-cache` will instruct Nx not to use the local cache, passing `--no-cloud` will tell Nx not to use the remote cache from Nx Cloud.
