# Environment Variables

| Property                       | Type    | Description                                                                                                                                                                                                           |
| ------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NX_VERBOSE_LOGGING             | boolean | If set to `true`, will print debug information useful for troubleshooting                                                                                                                                             |
| NX_PERF_LOGGING                | boolean | If set to `true`, will print debug information useful for for profiling executors and Nx itself                                                                                                                       |
| NX_TASKS_RUNNER_DYNAMIC_OUTPUT | boolean | If set to `false`, will use non-dynamic terminal output strategy (what you see in CI), even when you terminal can support the dynamic version                                                                         |
| NX_CACHE_DIRECTORY             | string  | The cache is stored in `node_modules/.cache/nx` by default. Set this variable to use a different directory.                                                                                                           |
| NX_SKIP_NX_CACHE               | boolean | Rerun the tasks even when the results are available in the cache                                                                                                                                                      |
| NX_CACHE_PROJECT_GRAPH         | boolean | If set to `false`, disables the project graph cache. Most useful when developing a plugin that modifies the project graph.                                                                                            |
| NX_DAEMON                      | boolean | If set to `false`, disables the Nx daemon process. Disable the daemon to print `console.log` statements in plugin code you are developing.                                                                            |
| NX_PROFILE                     | string  | Prepend `NX_PROFILE=profile.json` before running targets with Nx to generate a file that be [loaded in Chrome dev tools](/recipe/performance-profiling) to visualize the performance of Nx across multiple processes. |

## Related Recipes:

- [Define Environment Variables](/recipe/define-environment-variables)
- [Use environment variables in React apps](/recipe/use-environment-variables-in-react)
- [Use environment variables in Angular apps](/recipe/use-environment-variables-in-angular)
- [Profiling Performance](/recipe/performance-profiling)
