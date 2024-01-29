# Use Remote Caching

By default Nx [caches task computations locally](/core-features/cache-task-results). However, to benefit from the cache across your team and in particular on CI, the computation cache can also be distributed across multiple machines. Nx Cloud is an app that provides a fast and zero-config implementation of remote caching. It is a commercial add-on to Nx, is completely free for OSS projects and comes with generous plans for startups and dedicated offerings for enterprise customers ([read more here](https://nx.app/pricing)).

![Diagram showing Teika sharing his cache with CI, Kimiko and James](/shared/images/dte/distributed-caching.svg)

In this diagram, Teika runs the build once on his machine, then CI, Kimiko and James can use the cached artifact from Teika instead of re-executing the same work.

## Setup Remote Caching with Nx Cloud

To enable remote caching for your Nx workspace run the following command:

```shell
npx nx connect
```

This connects your workspace with Nx Cloud's remote caching service. It will also allow you to benefit from other Nx Cloud features such as [distributed task execution](/ci/features/distribute-task-execution).

To see the remote cache in action, run:

```{% command="nx build header && nx reset && nx build header"%}
> nx run header:build

> header@0.0.0 build
> rimraf dist && rollup --config

src/index.tsx → dist...
created dist in 786ms

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

  NX   Successfully ran target build for project header (2s)

   See logs and investigate cache misses at https://cloud.nx.app/runs/k0HDHACpL8


  NX   Resetting the Nx workspace cache and stopping the Nx Daemon.

   This might take a few minutes.


  NX   Daemon Server - Stopped


  NX   Successfully reset the Nx workspace.


> nx run header:build  [remote cache]


> header@0.0.0 build
> rimraf dist && rollup --config


src/index.tsx → dist...
created dist in 786ms

 —————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

  NX   Successfully ran target build for project header (664ms)

   Nx read the output from the cache instead of running the command for 1 out of 1 tasks.

   Nx Cloud made it possible to reuse header: https://nx.app/runs/P0X6ZGTkqZ
```

## Claim your Nx Cloud Workspace

During the setup process you might have seen a link to claim your Nx Cloud connected workspace.

```plaintext
 NX   NOTE  Nx Cloud has been enabled

  Your workspace is currently public. Anybody with code access
  can view the workspace on nx.app.

  You can connect the workspace to your Nx Cloud account at
  https://nx.app/orgs/workspace-setup?accessToken=N2Y3NzcyO...
  (You can do this later.)
```

Click on this link to associate the workspace with your Nx Cloud account. If you don't have an Nx Cloud account, you can create one on the spot.

![Nx Cloud Workspace Dashboard](/shared/images/nx-cloud/nx-cloud-workspace-overview.png)

Claiming your workspace allows you to

- see stats about your CI runs, cache hits number of agents used for distributing tasks
- enable [source control integrations](/ci/recipes/source-control-integration) to get information embedded in your GitHub, Bitbucket or GitLab PRs
- manage and create access tokens and [adjust access and permission](/ci/concepts/cache-security)
- manage your organization & user permissions for your Nx Cloud workspace

**If you lose this link, you can still connect your workspace to Nx Cloud**. Go to [nx.app](https://nx.app), create an account, and connect your workspace using the access token from `nx.json`.

## Skipping Cloud Cache

Similar to how `--skip-nx-cache` will instruct Nx not to use the local cache, passing `--no-cloud` will tell Nx not to use the remote cache from Nx Cloud.
