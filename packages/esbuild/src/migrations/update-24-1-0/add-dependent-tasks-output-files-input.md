#### Hash the outputs of dependent tasks in esbuild builds

Adds a `dependentTasksOutputFiles` input to the `inputs` of `@nx/esbuild:esbuild` targets, in the `targetDefaults` of `nx.json` and in project configuration.

esbuild bundles a workspace library from that library's build output when its `package.json` points there. Without this input, nothing in the task's hash covers those files, so the build can be restored from the cache after a dependency's output has changed.

Targets and `targetDefaults` entries that declare no `inputs`, or that already list a `dependentTasksOutputFiles` input, are left as they are.

#### Sample code changes

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/esbuild:esbuild": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "@nx/esbuild:esbuild": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": [
        "production",
        "^production",
        { "dependentTasksOutputFiles": "**/*", "transitive": true }
      ]
    }
  }
}
```
