# Distribute Task Execution (DTE)

Typically, when developers try to optimize their CI performance, they try to parallelize their tasks on multiple machines using a binning approach that ends up looking something like this:

![CI using binning](../images/dte/binning.svg)

When you set up Nx's distributed task execution, your task graph will look more like this:

![CI using DTE](../images/dte/3agents.svg)

And not only will CI finish faster, but the debugging experience is the same as if you ran all of your CI on a single machine. That's because Nx uses distributed caching to recreate all of the logs and build artifacts on the main process.

## Set up

To distribute your task execution, you need to (1) connect to Nx Cloud and (2) enable DTE in your CI workflow. Each of these steps can be enabled with a single command:

```shell title="1. Connect to Nx Cloud"
nx connect-to-nx-cloud
```

```shell title="2. Enable DTE in CI"
nx generate @nrwl/workspace:ci-workflow --ci=github
```

The `--ci` flag can be `github`, `circleci` or `azure`. For more details on setting up DTE, read [this guide](https://nx.dev/nx-cloud/set-up/set-up-dte).

## CI Execution Flow

There are two main parts to the CI set up:

1. The main job that controls what is going to be executed
2. The agent jobs that actually execute the tasks

The main job execution flow looks like this:

```yml
# Coordinate the agents to run the tasks
- npx nx-cloud start-ci-run
# Run any commands you want here
- nx affected --target=lint
- nx affected --target=test
- nx affected --target=build
# Stop any run away agents
- npx nx-cloud stop-all-agents
```

The agent job execution flow is very simple:

```yml
# Wait for tasks to execute
- npx nx-cloud start-agent
```

## Illustrated Guide

For more details about how distributed task execution works, check out the [illustrated guide](/concepts/dte) by Nrwlian [Nicole Oliver](https://twitter.com/nixcodes).

[![how does distributed task execution work in Nx Cloud?](../images/dte/how-does-dte-work.jpeg)](/concepts/dte)

## See Also

- [Nx Cloud Documentation](/nx-cloud/intro/what-is-nx-cloud)
- [Nx Cloud Main Site](https://nx.app)
