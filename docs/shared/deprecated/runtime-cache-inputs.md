# runtimeCacheInputs

The `runtimeCacheInputs` property was used as a way to add extra inputs to the Nx cache, like the version of node on that particular machine.

`runtimeCacheInputs` were set as follows:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"],
        "runtimeCacheInputs": ["node -v"]
      }
    }
  }
}
```

Instead of specifying the runtime inputs in `tasksRunnerOptions`, you can now include them as runtime inputs in the standard [`inputs` and `namedInputs` area of your project configuration](/reference/project-configuration#inputs-&-namedinputs) or [`nx.json`](/reference/nx-json#inputs-&-namedinputs).

The new style looks like this:

```jsonc
{
  "targets": {
    "build": {
      "inputs": ["^build", { "runtime": "node -v" }]
      // ...
    }
  }
}
```
