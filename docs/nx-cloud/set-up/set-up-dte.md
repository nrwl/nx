# Set Up Distributed Task Execution

To enable distributed task execution, the following has to be true:

1. `NX_CLOUD_DISTRIBUTED_EXECUTION` has to be set to `true`.
2. Agents must be started using the nx-cloud start-agent command, and must be stopped at the end using `nx-cloud stop-all-agents`.

The examples below use 3 agents to run all builds, tests, and lints.

Note that only cacheable operations can be distributed because they have to be replayed on the main job.

You don't have to distribute every single command. For instance, it's pretty common to send test coverage reports from a single machine. You can do it as follows:

```yaml
- run: npx nx affected --target=test --parallel --max-parallel=2
- run: NX_CLOUD_DISTRIBUTED_EXECUTION=false npx nx affected --target=send-coverage-reports --parallel
```

Distributed task execution will copy all artifacts from agents to the main job, so after the `affected --target=test` command completes, all the coverage reports will be on the main job.

Note, the `--parallel` flag is propagated to Nx Cloud agents.

## Agents

In the examples below, the config creates one main job and three agent jobs. All four jobs have the same environment and the same source code. The four jobs will start around the same time. And, once the main job completes, all the agents will be stopped.

It's important to note that an Nx Cloud agent isn't a machine but rather a long-running process that runs on a machine. In the examples below, the config provisions three machines that run `nx-cloud start-agent`. Nx Cloud does not start agents. It simply coordinates work between the agents that you start in your CI. So you are in control of how many agents you want to use and where they are located.

## Additional Configuration Options

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT` to say 8 will tell Nx Cloud assume that there are 8 agents running.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE` to false will tell Nx Cloud not to stop agents if a command fails. You need to make sure to invoke `nx-cloud stop-all-agents` even if CI fails.

## Distributed Task Execution and Sharding

The Nx Cloud distributed task execution model is akin to what is used at Google or Facebook. It scales better and provided more flexibility than sharding tasks across agents. [Read more about Distributed Task Execution and how it compares to binning/sharding.](https://blog.nrwl.io/distributing-ci-binning-and-distributed-task-execution-632fe31a8953?source=friends_link&sk=5120b7ff982730854ed22becfe7a640a)

## CI/CD Examples

The examples below show how to set up CI using Nx and Nx Cloud using distributed task execution and distributed caching.

Every organization manages their CI/CD pipelines differently, so the examples don't cover org-specific aspects of CI/CD (e.g., deployment). They mainly focus on configuring Nx correctly.

Read the guides for more information on how to configure them in CI.

- [Azure Pipelines](/ci/monorepo-ci-azure#distributed-ci-with-nx-cloud)
- [Circle CI](/ci/monorepo-ci-circle-ci#distributed-ci-with-nx-cloud)
- [GitHub Actions](/ci/monorepo-ci-github-actions#distributed-ci-with-nx-cloud)
- [Jenkins](/ci/monorepo-ci-jenkins#distributed-ci-with-nx-cloud)

## Additional Notes

### Env Variables

The `@nrwl/nx-cloud` requires the `NX_BRANCH` environment variables to be set. For many CI providers (e.g., GitHub Actions), the runner is able to set it automatically. For others, the variable will have to be set manually. If you set it manually, note that `NX_BRANCH` has to be set to a PR number for the GitHub integration to work.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION` to true enables distributed task execution.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT` to say 8 will tell Nx Cloud assume that there are 8 agents running.

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE` to true will tell Nx Cloud not to stop agents if a command fails. You need to make sure to invoke nx-cloud stop-all-agents even if CI fails.

Setting `NX_VERBOSE_LOGGING` to true will output the debug information about agents communicating with the main job. It's a good way to troubleshoot issues.

Setting `NX_CLOUD_ENV_NAME` will prefix all your commands so you can easily distinguish them in the UI and in GitHub comments. For instance, if you run the same set of commands on Windows and Linux machines, you can set `NX_CLOUD_ENV_NAME` to win on the Windows agent, and linux on Linux agents.
