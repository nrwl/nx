# Parallelization and Distribution

Nx speeds up your CI in several ways. One method is to reduce wasted calculations with the [affected command](/ci/features/affected) and [remote caching](/ci/features/remote-cache). No matter how effective you are at eliminating wasted calculations in CI, there will always be some tasks that really do need to be executed and sometimes that list of tasks will be everything in the repository.

To speed up the essential tasks, Nx [efficiently orchestrates](/concepts/task-pipeline-configuration) the tasks so that prerequisite tasks are executed first, but independent tasks can all be executed concurrently. Running tasks concurrently can be done with parallel processes on the same machine or distributed across multiple machines.

## Parallelization

Any time you execute a task, Nx will parallelize as much as possible. If you run `nx build my-project`, Nx will build the dependencies of that project in parallel as much as possible. If you run `nx run-many -t build` or `nx affected -t build`, Nx will run all the specified tasks and their dependencies in parallel as much as possible.

Nx will limit itself to the maximum number of parallel processes set in the `parallel` property in `nx.json`. To set that limit to `2` for a specific command, you can specify `--parallel=2` in the terminal. This flag works for individual tasks as well as `run-many` and `affected`.

Unfortunately, there is a limit to how many processes a single computer can run in parallel at the same time. Once you hit that limit, you have to wait for all the tasks to complete.

#### Pros and Cons of Using a Single Machine to Execute Tasks on Parallel Processes:

| Characteristic | Pro/Con | Notes                                                                            |
| -------------- | ------- | -------------------------------------------------------------------------------- |
| Complexity     | 🎉 Pro  | The pipeline uses the same commands a developer would use on their local machine |
| Debuggability  | 🎉 Pro  | All build artifacts and logs are on a single machine                             |
| Speed          | ⛔️ Con | The larger a repository gets, the slower your CI will be                         |

## Distribution Across Machines

Once your repository grows large enough, it makes sense to start using multiple machines to execute tasks in CI. This adds some extra cost to run the extra machines, but the cost of running those machines is much less than the cost of paying developers to sit and wait for CI to finish.

You can either distribute tasks across machines manually, or use Nx Cloud distributed task execution to automatically assign tasks to machines and gather the results back to a single primary machine. When discussing distribution, we refer to the primary machine that determines which tasks to run as the main machine (or job). The machines that only execute the tasks assigned to them are called agent machines (or jobs).

### Manual Distribution

One way to manually distribute tasks is to use binning. Binning is a distribution strategy where there is a main job that divides the work into bins, one for each agent machine. Then every agent executes the work prepared for it. Here is a simplified version of the binning strategy.

```yaml {% fileName="main-job.yml" %}
# Get the list of affected projects
- nx show projects --affected --json > affected-projects.json
# Store the list of affected projects in a PROJECTS environment variable
# that is accessible by the agent jobs
- node storeAffectedProjects.js
```

```yaml {% fileName="lint-agent.yml" %}
# Run lint for all projects defined in PROJECTS
- nx run-many --projects=$PROJECTS -t lint
```

```yaml {% fileName="test-agent.yml" %}
# Run test for all projects defined in PROJECTS
- nx run-many --projects=$PROJECTS -t test
```

```yaml {% fileName="build-agent.yml" %}
# Run build for all projects defined in PROJECTS
- nx run-many --projects=$PROJECTS -t build
```

Here's a visualization of how this approach works:
![CI using binning](/shared/images/dte/binning.svg)

This is faster than the single machine approach, but you can see that there is still idle time where some agents have to wait for other agents to finish their tasks.

There's also a lot of complexity hidden in the idle time in the graph. If `test-agent` tries to run a `test` task that depends on a `build` task that hasn't been completed yet by the `build-agent`, the `test-agent` will start to run that `build` task without pulling it from the cache. Then the `build-agent` might start to run the same `build` task that the `test-agent` is already working on. Now you've reintroduced waste that remote caching was supposed to eliminate.

It is possible in a smaller repository to manually calculate the best order for tasks and encode that order in a script. But that order will need to be adjusted as the repository structure changes and may even be suboptimal depending on what projects were affected in a given PR.

#### Pros and Cons of Manually Distributing Tasks Across Multiple Machines:

| Characteristic | Pro/Con | Notes                                                                                                               |
| -------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Complexity     | ⛔️ Con | You need to write custom scripts to tell agent machines what tasks to execute. Those scripts need to be maintained. |
| Debuggability  | ⛔️ Con | Build artifacts and logs are scattered across agent machines.                                                       |
| Speed          | 🎉 Pro  | Faster than using a single machine                                                                                  |

### Nx Cloud Distributed Task Execution

When you use Nx Cloud's distributed task execution you gain even more speed than manual distribution while preserving the simple set up and easy debuggability of the single machine scenario.

The setup looks like this:

```yaml {% fileName="main-job.yml" %}
# Coordinate the agents to run the tasks and stop agents when the build tasks are done
- npx nx-cloud start-ci-run --stop-agents-after=build
# Run any commands you want here
- nx affected -t lint,test,build
```

```yaml {% fileName="agent.yml" %}
# Wait for tasks to execute
- npx nx-cloud start-agent
```

The visualization for distributed task execution looks like this:
![CI using DTE](/shared/images/dte/3agents.svg)

In the same way that Nx efficiently assigns tasks to parallel processes on a single machine so that pre-requisite tasks are executed first, Nx Cloud's distributed task execution efficiently assigns tasks to agent machines so that the idle time of each agent machine is kept to a minimum. Nx performs these calculations for each PR, so no matter which projects are affected or how your project structure changes, Nx will optimally assign tasks to the agents available.

As your repository grows and CI runs start to slow down, add another agent machine to your pipeline and Nx Cloud will use that extra capacity to handle the larger volume of tasks. If you would like Nx Cloud to automatically provision the agents for you, check out [Nx Agents](/ci/features/nx-agents).

#### Pros and Cons of Using Nx Cloud's Distributed Task Execution:

| Characteristic | Pro/Con | Notes                                                                                                                                                                       |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complexity     | 🎉 Pro  | The pipeline uses the same commands a developer would use on their local machine, but with one extra line before running tasks and a single line for each agent to execute. |
| Debuggability  | 🎉 Pro  | Build artifacts and logs are collated to the main machine as if all tasks were executed on that machine                                                                     |
| Speed          | 🎉 Pro  | Fastest possible task distribution for each PR                                                                                                                              |

### Nx Cloud Concurrency Limits

As you scale your usage of Nx Cloud, you may run into concurrency limits. Nx Cloud puts a [limit on the number of CI machines](https://nx.app/pricing) in your workspace that are simultaneously connecting to Nx Cloud. This includes any machine running in CI - both the main CI pipeline machine and any agent machines.

The Free plan offers 30 concurrent connections, the Startup plan offers 50 concurrent connections, the Pro plan offers 70 concurrent connections and the enterprise plan has no limit on concurrent connections. If each pipeline uses 9 agents in addition to the main job, that makes 10 concurrent connections for each PR. This would mean that on a Pro plan, you can have a maximum of 7 PRs running in CI simultaneously. If an eighth PR was submitted while those 7 were still running, your CI pipeline would experience some degradation and eventually failed CI runs. Once your organization's usage goes below the limit, Nx Cloud will resume functioning as normal.

## Conclusion

If your repo is starting to grow large enough that CI times are suffering, or if your parallelization strategy is growing too complex to manage effectively, try [setting up Nx Cloud with Distributed Task Execution](/ci/features/distribute-task-execution). You can [generate a simple workflow](/nx-api/workspace/generators/ci-workflow) for common CI providers with a `nx g ci-workflow` or follow one of the [CI setup recipes](/ci/recipes/set-up).

Organizations that want extra help setting up Nx Cloud or getting the most out of Nx can [sign up for Nx Enterprise](https://nx.app/enterprise/). This package comes with extra support from the Nx team and the option to host Nx Cloud on your own servers.
