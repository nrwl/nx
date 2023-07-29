# Troubleshoot Cache Misses

Problem: A task is being executed when you expect it to be replayed from the cache.

1. Check if your task is listed in `cacheableOperations` defined in `nx.json#tasksRunnerOptions`

1. Check if the output of your task is changing the inputs of your task

   - Check the `inputs` and `namedInputs` defined in the project configuration and root `nx.json`. The `inputs` control whether a task will execute or replay from cache.
   - Check to see if there is an output file that is not being captured by the `outputs` for the task. The `outputs` property only controls what files are replayed from the cache, it doesn't dictate whether the cache is replayed, but an unaccounted output file could be modifying one of the inputs of the task.
   - To check your input glob patterns file-by-file, you can get a list of all the files associated with each project by running: `nx graph --file=output.json`

1. Use the Nx Cloud troubleshooting tools
   - Make sure your repo is [connected to Nx Cloud](/core-features/cache-task-results#distributed-computation-caching)
   - Click on the run details link that is printed in the terminal after you run a task
   - Expand a task that had a cache miss
   - Click "Check For Near Misses" to see other similar tasks
   - Copy one of those similar tasks' run details links (or a run details link from another local run)
   - Click the "Compare to Similar Tasks" link in the task details on the run details page
   - Paste the other run details link you copied into the form to see exactly why the two tasks were different.
   - Note: Nx Cloud does not have access to your actual source code, so it can only tell you which projects were different, not the exact git diff of the source code.
