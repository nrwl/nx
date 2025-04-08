---
title: 'Runtime Cache Inputs'
description: 'Learn about the transition from runtimeCacheInputs in tasksRunnerOptions to the new inputs and namedInputs configuration for runtime cache inputs.'
---

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

Instead of specifying the runtime inputs in `tasksRunnerOptions`, in Nx 14.4 you can include them as runtime inputs in the standard [`inputs` and `namedInputs` area of your project configuration](/reference/project-configuration#inputs-and-named-inputs) or [`nx.json`](/reference/nx-json#inputs-namedinputs).

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
