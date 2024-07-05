# Use Remote Caching (Nx Replay)

By default Nx [caches task computations locally](/features/cache-task-results). However, to benefit from the cache across your team and in particular on CI, the computation cache can also be distributed across multiple machines.

The **Nx Replay** feature of Nx Cloud is a fast, secure and zero-config implementation of remote caching.

![Diagram showing Teika sharing his cache with CI, Kimiko and James](/shared/images/dte/distributed-caching.svg)

In this diagram, Teika runs the build once on his machine, then CI, Kimiko and James can use the cached artifact from Teika instead of re-executing the same work.

## Setting Up Nx Cloud

To use **Nx Replay** you need to connect your workspace to Nx Cloud. See the [connect to Nx Cloud recipe](/ci/intro/connect-to-cloud).

## See Remote Caching in Action

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

## Benefits of Nx Replay

There are two ways that Nx Replay directly benefits your organization.

### 1. Speed Up CI Pipelines for Modified PRs

The first time a PR goes through the CI pipeline, the [affected](/ci/features/affected) command provides most of the time savings. The `affected` command compares the PR against the `main` branch and only runs tasks for projects that could have been affected by the code changes. Unfortunately, all the projects affected by the first CI pipeline for a PR will continue to be affected by all future commits to that PR. This is because `affected` compares the current commit with the `main` branch every time.

With Nx Replay enabled, any tasks that were run during the first pipeline and not affected by the second commit would reuse the cached results from the first pipeline instead of re-running the task. This gives subsequent pipeline runs a mechanism similar to affected that will [reduce the wasted time in CI](/ci/concepts/reduce-waste).

### 2. Reuse Cached Results from CI on Developer Machines

If a task has been executed in CI, a developer running that same task locally can reuse the task result instead of actually running the task. Here are a couple common scenarios where this happens:

1. A developer pulls the latest code from `main` and rebuilds an application. The build finishes instantly and they're ready to start working.
2. A developer checks out someone else's PR branch to help troubleshoot a problem. They run the tests and all the successful tests finish instantly. They can focus their debugging time on the few tests that are still failing.

The best part about Nx Replay is that developers will experience the benefits of it without needing to remember to use it. Some of their tasks will just finish much faster than they normally do.

## Nx Replay Enables Nx Agents

One more indirect benefit of Nx Replay is that it is critical to the way [Nx Agents](/ci/features/distribute-task-execution) is built. Nx Agents relies heavily on the remote cache in order to ensure that all task artifacts are present on the agent machines where they are needed. Each agent can naively run the dependencies for the tasks it is assigned and rely on Nx Replay to retrieve the cached tasks results for those tasks. Nx Replay ensures that each task will only run on one agent and the results of that task will be shared with every agent that needs them.

## Skipping Cloud Cache

Similar to how `--skip-nx-cache` will instruct Nx not to use the local cache, passing `--no-cloud` will tell Nx not to use the remote cache from Nx Cloud.
