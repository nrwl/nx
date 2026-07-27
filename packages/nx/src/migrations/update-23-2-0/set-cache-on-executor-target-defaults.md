#### Set cache on executor-based target defaults

Maintains compatibility with how cacheability was resolved before Nx 23.

Target defaults resolve to a single key rather than merging them. When a target matches both a target name key and an executor key, the executor key is the one that applies, and the target name key is not read at all. Earlier versions of Nx also derived cacheability from target names, so `"cache": true` on the target name key still took effect even when an executor key applied. Nx 23 reads cacheability from the resolved target only.

This migration copies `cache` onto each executor key that applies to a target whose target name key enables it, so those targets remain cacheable.

Executor keys that already set `cache` keep their existing value, and only executor keys that apply to a target in the workspace are updated.

#### Sample code changes

Given a project with a `build` target that uses the `@nx/angular:webpack-browser` executor:

##### Before

```json title="nx.json"
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "@nx/angular:webpack-browser": {
      "inputs": ["production", "^production"]
    }
  }
}
```

##### After

```json title="nx.json"
{
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"]
    },
    "@nx/angular:webpack-browser": {
      "inputs": ["production", "^production"],
      "cache": true
    }
  }
}
```
