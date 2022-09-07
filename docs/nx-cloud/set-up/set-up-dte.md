# Set Up Distributed Task Execution

> Make sure to use the latest version of `@nrwl/nx-cloud`. The latest version works with any version of Nx >= 13.0.

## How It Works

When using Nx Cloud Distributed Task Execution (DTE), you split your CI setup into two parts:

- The main job that controls what is going to be executed
- The agent jobs that actually execute the tasks

The main job execution flow looks like this:

```yaml
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

```yaml
# Wait for tasks to execute
- npx nx-cloud start-agent
```

The main job looks more or less the same way as if you haven't used any distribution. The only thing you need to do is
to invoke `npx nx-cloud start-ci-run` at the beginning and optionally invoke `npx nx-cloud stop-all-agents` at the end.

The agent jobs run long-running `start-agent` processes that execute all the tasks associated with a given CI run. The
only thing you need to do to set them up is to invoke `npx nx-cloud start-agent`. This process will keep running until
Nx Cloud tells it to terminate.

> Note it's important that the main job and the agent jobs have the same environment and the same source code. They start
> around the same time. And, once the main job completes, all the agents
> will be stopped.

It's also important to note that an Nx Cloud agent isn't a machine but rather a long-running process that runs on a
machine. I.e., Nx Cloud doesn't manage your agents--you need to do it in your CI config (check out CI examples below).

Nx Cloud is an orchestrator. The main job tells Nx Cloud what you want to run, and Nx Cloud will distribute those tasks
across the agents. Nx Cloud will automatically move files from one agent to another, from the agents to the main job.

The end result is that when say `nx affected --target=build` completes on the main job, all the file artifacts created
on agents are copied over to the main job, as if the main job had built everything locally.

### Relevant Documentation

- [Distribute Task Execution](/core-features/distribute-task-execution)
- [Distributed Task Execution Illustrated Guide](/concepts/dte).

## npx nx-cloud start-ci-run

At the beginning of your main job, invoke `npx nx-cloud start-ci-run`. This tells Nx Cloud that the following series of
command correspond to the same CI run.

You can configure your CI run by passing the following flags:

### --use-dte-by-default

By default, invoking `npx nx-cloud start-ci-run` will configure Nx to distribute all commands by default. You can
disable this as follows: `npx nx-cloud start-ci-run --use-dte-by-default=false`.

### --stop-agents-on-failure

By default, a failure in one of the commands is going to terminate the whole CI run and will stop all the
agents. You can disable this as follows: `npx nx-cloud start-ci-run --stop-agents-on-failure=false`.

### --stop-agents-after

By default, Nx Cloud won't terminate any agents until you invoke `npx nx-cloud stop-all-agents` because Nx Cloud
doesn't know if you will need agents to run another command. This can result in agents being idle at the end of a CI
run.

You can fix it by telling Nx Cloud that it can terminate agents after it sees a certain
target: `npx nx-cloud start-ci-run --stop-agents-after=e2e`.

> Earlier versions of `@nrwl/nx-cloud` required you to set the `NX_CLOUD_DISTRIBUTED_EXECUTION` env variable to `true`
> to
> enable DTE, but in the latest version `npx nx-cloud start-ci-run` does it automatically.

## Enabling/Disabling DTE

Invoking `npx nx-cloud start-ci-run` will tell Nx to distribute by default. You can enable/disable distribution for
individual commands as follows:

- `nx affected --target=build --dte` (explicitly enable distribution, Nx >= 14.7)
- `nx affected --target=build --no-dte` (explicitly disable distribution, Nx >= 14.7)
- `NX_CLOUD_DISTRIBUTED_EXECUTION=true nx affected --target=build` (explicitly enable distribution)
- `NX_CLOUD_DISTRIBUTED_EXECUTION=false nx affected --target=build` (explicitly disable distribution)

## npx nx-cloud stop-all-agents

This command tells Nx Cloud to terminate all agents associated with this CI run.

## Running Things in Parallel

`--parallel` is propagated to the agents. E.g., `npx nx affected --target=build --parallel=3 --dte` tells Nx Cloud to run
up to 3 build targets in parallel on each agent. So if you have say 10 agents, you will run up to 30 builds in parallel
across all of them.

You also want to run as many commands in parallel as you can. For instance,

```yaml
- nx affected --target=build
- nx affected --target=test
- nx affected --target=lint
```

is worse than

```yaml
- nx affected --target=build & nx affected --target=test & nx affected --target=lint
```

The latter is going to schedule all the three commands at the same time, so if an agent cannot find anything to build, it will start running tests and lints. The result is better agent utilization and shorter CI time.

## CI/CD Examples

The examples below show how to set up CI using Nx and Nx Cloud using distributed task execution and distributed caching.

Every organization manages their CI/CD pipelines differently, so the examples don't cover org-specific aspects of
CI/CD (e.g., deployment). They mainly focus on configuring Nx correctly.

Read the guides for more information on how to configure them in CI.

- [Overview](/recipes/ci-setup#distributed-ci-with-nx-cloud)
- [Azure Pipelines](/recipe/monorepo-ci-azure#distributed-ci-with-nx-cloud)
- [Circle CI](/recipe/monorepo-ci-circle-ci#distributed-ci-with-nx-cloud)
- [GitHub Actions](/recipe/monorepo-ci-github-actions#distributed-ci-with-nx-cloud)
- [Jenkins](/recipe/monorepo-ci-jenkins#distributed-ci-with-nx-cloud)

Note that only cacheable operations can be distributed because they have to be replayed on the main job.

## Additional Notes

### Env Variables

- The `@nrwl/nx-cloud` requires the `NX_BRANCH` environment variables to be set. For many CI providers (e.g., GitHub
  Actions), the runner is able to set it automatically. For others, the variable will have to be set manually. If you set
  it manually, note that `NX_BRANCH` has to be set to a PR number for the GitHub integration to work.

- The `@nrwl/nx-cloud` requires the `NX_RUN_GROUP` environment variables to be set. For many CI providers (e.g., GitHub
  Actions), the runner is able to set it automatically. For others, the variable will have to be set manually. If you set
  it manually, note that `NX_RUN_GROUP` has to be a unique value associated with a CI run.

- Setting `NX_CLOUD_DISTRIBUTED_EXECUTION` to true enables distributed task execution.

- Setting `NX_VERBOSE_LOGGING` to true will output the debug information about agents communicating with the main job.
  It's a good way to troubleshoot issues.

- Setting `NX_CLOUD_ENV_NAME` will prefix all your commands so you can easily distinguish them in the UI and in GitHub
  comments. For instance, if you run the same set of commands on Windows and Linux machines, you can
  set `NX_CLOUD_ENV_NAME` to win on the Windows agent, and linux on Linux agents.

## Relevant Repositories and Examples

- [Nx: On how to make your CI 16 times faster with a small config change](https://github.com/vsavkin/interstellar)
- ["Lerna & Distributed Task Execution" Example](https://github.com/vsavkin/lerna-dte)
