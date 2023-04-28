# Environment Variables

The following environment variables are ones that you can set to change the behavior of Nx in different environments.

| Property                         | Type    | Description                                                                                                                                                                                                                  |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NX_BASE                          | string  | The default base branch to use when calculating the affected projects. Can be overridden on the command line with `--base`.                                                                                                  |
| NX_CACHE_DIRECTORY               | string  | The cache for task outputs is stored in `node_modules/.cache/nx` by default. Set this variable to use a different directory.                                                                                                 |
| NX_CACHE_PROJECT_GRAPH           | boolean | If set to `false`, disables the project graph cache. Most useful when developing a plugin that modifies the project graph.                                                                                                   |
| NX_DAEMON                        | boolean | If set to `false`, disables the Nx daemon process. Disable the daemon to print `console.log` statements in plugin code you are developing.                                                                                   |
| NX_DEFAULT_PROJECT               | string  | The default project used for commands which require a project. e.g. `nx build`, `nx g component`, etc.                                                                                                                       |
| NX_HEAD                          | string  | The default head branch to use when calculating the affected projects. Can be overridden on the command line with `--head`.                                                                                                  |
| NX_PERF_LOGGING                  | boolean | If set to `true`, will print debug information useful for for profiling executors and Nx itself                                                                                                                              |
| NX_PROFILE                       | string  | Prepend `NX_PROFILE=profile.json` before running targets with Nx to generate a file that be [loaded in Chrome dev tools](/recipes/other/performance-profiling) to visualize the performance of Nx across multiple processes. |
| NX_PROJECT_GRAPH_CACHE_DIRECTORY | string  | The project graph cache is stored in `node_modules/.cache/nx` by default. Set this variable to use a different directory.                                                                                                    |
| NX_PROJECT_GRAPH_MAX_WORKERS     | number  | The number of workers to use when calculating the project graph.                                                                                                                                                             |
| NX_RUNNER                        | string  | The name of task runner from the config to use. Can be overridden on the command line with `--runner`. Not read if NX_TASKS_RUNNER is set.                                                                                   |
| NX_SKIP_NX_CACHE                 | boolean | Rerun the tasks even when the results are available in the cache                                                                                                                                                             |
| NX_TASKS_RUNNER                  | string  | The name of task runner from the config to use. Can be overridden on the command line with `--runner`. Preferred over NX_RUNNER.                                                                                             |
| NX_TASKS_RUNNER_DYNAMIC_OUTPUT   | boolean | If set to `false`, will use non-dynamic terminal output strategy (what you see in CI), even when you terminal can support the dynamic version                                                                                |
| NX_VERBOSE_LOGGING               | boolean | If set to `true`, will print debug information useful for troubleshooting                                                                                                                                                    |
| NX_DRY_RUN                       | boolean | If set to `true`, will perform a dry run of the generator. No files will be created and no packages will be installed.                                                                                                       |
| NX_INTERACTIVE                   | boolean | If set to `true`, will allow Nx to prompt you in the terminal to answer some further questions when running generators.                                                                                                      |
| NX_GENERATE_QUIET                | boolean | If set to `true`, will prevent Nx logging file operations during generate                                                                                                                                                    |
| NX_PREFER_TS_NODE                | boolean | If set to `true`, Nx will use ts-node for local execution of plugins even if `@swc-node/register` is installed.                                                                                                              |

Nx will set the following environment variables so they can be accessible within the process even outside of executors and generators

| Property                     | Type    | Description                                                                                                           |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| NX_TASK_TARGET_PROJECT       | string  | Set to the project name of the task being run. Use this to tell which project is being run.                           |
| NX_TASK_TARGET_TARGET        | string  | Set to the target name of the task being run. Use this to tell which target of the project is being run.              |
| NX_TASK_TARGET_CONFIGURATION | string  | Set to the configuration name of the task being run. Use this to tell which configuration of the target is being run. |
| NX_DRY_RUN                   | boolean | Set to `true` during dry runs of generators. Use this to avoid side effects during generators.                        |
| NX_INTERACTIVE               | boolean | Set to `false` when running generators with `--interactive=false`. Use this to prevent prompting during generators    |

When using distributed caching, [Nx Cloud Environment Variables](/nx-cloud/reference/env-vars) are also available.
