# Building Blocks of Fast CI

Nx has many features that make your CI faster. Each of these features speeds up your CI in a different way, so that enabling an individual feature will have an immediate impact. These features are also designed to complement each other so that you can use them together to create a fully optimized CI pipeline.

## Use Fast Build Tools

The purpose of a CI pipeline is to run tasks like `build`, `test`, `lint` and `e2e`. You use different tools to run these tasks (like Webpack or Vite for you `build` task). If the individual tasks in your CI pipeline are slow, then your overall CI pipeline will be slow. Nx has two ways to help with this.

Nx provides plugins for popular tools that make it easy to update to the latest version of that tool and [automatically updates](/features/automate-updating-dependencies) your configuration files to take advantage of enhancements in the tool. The tool authors are always looking for ways to improve their product and the best way to get the most out of the tool you're using is to make sure you're on the latest version. Also, the recommended configuration settings for a tool will change over time so even if you're on the latest version of a tool, you may be using a slower version of it because you don't know about a new configuration setting. [`nx migrate`](/features/automate-updating-dependencies) will automatically change the default settings of in your tooling config to use the latest recommended settings so that your repo won't be left behind.

Because Nx plugins have a consistent interface for how they are invoked and how they interact with the codebase, it is easier to try out a different tool to see if it is better than what you're currently using. Newer tools that were created with different technologies or different design decisions can be orders of magnitude faster than your existing tools. Or the new tool might not help your project. Browse through the [list of Nx plugins](/plugin-registry), like [vite](/nx-api/vite) or [rspack](/nx-api/rspack), and try it out on your project with the default settings already configured for you.

## Reduce Wasted Time

In a monorepo, most PRs do not affect the entire codebase, so there's no need to run every test in CI for that PR. Nx provides the [`nx affected`](/ci/features/affected) command to make sure that only the tests that need to be executed are run for a particular PR.

Even if a particular project was affected by a PR, this could be the third time this same PR was run through CI and the build for this project was already run for this same exact set of files twice before. If you enable [remote caching](/ci/features/remote-cache), you can make sure that you never run the same command on the same code twice.

For a more detailed analysis of how these features reduce wasted time in different scenarios, read the [Reduce Wasted Time in CI guide](/ci/concepts/reduce-waste)

## Parallelize and Distribute Tasks Efficiently

Every time you use Nx to run a task, Nx will attempt to run the task and all its dependent tasks in parallel in the most efficient way possible. Because Nx knows about [task pipelines](/concepts/task-pipeline-configuration), it can run all the prerequisite tasks first. Nx will automatically run tasks in parallel processes up to the limit defined in the `parallel` property in `nx.json`.

There's a limit to how many tasks can be run in parallel on the same machine, but the logic that Nx uses to assign tasks to parallel processes can also be used by Nx Cloud to efficiently [distribute tasks across multiple agent machines](/ci/features/distribute-task-execution). Once those tasks are run, the [remote cache](/ci/features/remote-cache) is used to replay those task results on the main machine. After the pipeline is finished, it looks like all the tasks were run on a single machine - but much faster than a single machine could do it.

For a detailed analysis of different strategies for running tasks concurrently, read the [Parallelization and Distribution guide](/ci/concepts/parallelization-distribution)
