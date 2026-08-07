#### Set cache on executor-based target defaults

Maintains compatibility with how cacheability was resolved before Nx 23.

Target defaults resolve to a single key rather than merging them. When a target matches both a target name key and an executor key, the executor key is the one that applies, and the target name key is not read at all. Earlier versions of Nx also derived cacheability from target names, so `"cache": true` on the target name key still took effect even when an executor key applied. Nx 23 reads cacheability from the resolved target only.

This migration copies `cache` onto each executor key that applies to a target whose target name key enables it, so those targets remain cacheable.

An executor key applies to every target that resolves through it, so the migration updates a key only when it can establish that caching is right for all of them. It leaves the key unchanged when the key already declares `cache` or `continuous`, when a target through it is continuous or is a long-running target such as `serve`, `dev`, or `start`, when the executor's own schema marks its targets continuous, or when a target through it has no target name key enabling `cache`. It never updates the `nx:run-commands` or `nx:run-script` keys, because targets written with `command` and targets derived from `package.json` scripts resolve through those keys without naming them.

Where the migration makes no change, Nx still decides at run time, per target rather than per key: a target whose target name key enables `cache`, and whose resolved configuration leaves `cache` undefined, still gets it and is reported as a deprecated fallback. That is what covers the targets left behind because a sibling target through the same key does not opt in, and the targets reaching the `nx:run-commands` and `nx:run-script` keys. The remaining cases get no fallback and no warning: a continuous or long-running target because caching it is invalid, and a target through an executor key that already declares `cache` because that value is already resolved.

Targets are read from each project's `project.json` and from the `nx.targets` block of its `package.json`. Targets inferred by a plugin, and targets derived from `package.json` scripts, are not visible to the migration — the latter is why the `nx:run-script` key is never updated. A key that looks safe here may still serve an inferred target. Set `cache` on the executor key by hand only after checking that no target reaching it is continuous; Nx rejects a target that is both cacheable and continuous. Nx warns at run time and names both keys involved.

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
