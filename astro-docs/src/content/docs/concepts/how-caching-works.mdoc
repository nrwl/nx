---
title: How caching works
description: Learn how Nx caching reuses task results locally and across machines to avoid repeated work.
sidebar:
  order: 1
filter: 'type:Concepts'
---

Before running a cacheable task, Nx calculates a hash from the task's inputs.
Two runs with the same hash represent the same computation, so Nx can reuse the earlier result.

A task hash can include:

- Project source files and files from project dependencies.
- Relevant workspace configuration.
- Versions of external dependencies.
- Runtime values, such as the operating system and CPU architecture.
- Command-line arguments passed to the task.

![Inputs used to calculate a task hash](../../../assets/concepts/caching/nx-hashing.svg)

You can customize these inputs for each target.
For example, a lint target might depend on source files but not documentation, while a build target
might depend on generated declaration files from its dependencies.

## Cache lookup and storage

Nx checks the local cache after calculating the hash.
If it doesn't find a result and remote caching is configured, Nx checks the remote cache.
On a cache hit, Nx restores the cached output files and prints the stored terminal output.

![Nx checking local and remote caches](../../../assets/concepts/caching/cache.svg)

On a cache miss, Nx runs the task and stores its terminal output and configured output files in the
local cache.
Nx also stores the result in the remote cache when remote caching is configured and the current
authentication settings permit writes.

Nx processes each node in a task graph independently.
Some tasks can be cache hits while other tasks run normally.

![A large task graph with cached tasks](../../../assets/concepts/caching/task-graph-big.svg)

## Cache inputs and outputs

Each cacheable target has inputs and outputs:

- Inputs determine the task hash.
- Outputs identify files and directories to store and restore.

Plugins infer these settings when they understand the underlying tool.
You can override inferred values globally in `nx.json` or for one project in `package.json` or
`project.json`.

For detailed configuration options, see [configure inputs](/docs/kb/configure-inputs) and
[configure outputs](/docs/kb/configure-outputs).

## What Nx caches

Nx caches task results at the process level, regardless of whether the task builds, tests, lints, or
runs another tool.
A cache entry contains:

- Terminal output written to standard output and standard error.
- Files and directories matched by the target's `outputs` configuration.
- The task hash used to identify the entry.

Nx doesn't store the source files and other inputs inside the cache entry.
It uses their hashes to calculate the task hash.

The following project-level configuration overrides the inferred outputs for `build`:

```jsonc title="packages/myapp/package.json"
{
  "name": "myapp",
  "nx": {
    "targets": {
      "build": {
        "outputs": ["{projectRoot}/dist"],
      },
    },
  },
}
```

Use `targetDefaults` to apply the same output configuration to matching targets across the
workspace:

```jsonc title="nx.json"
{
  "targetDefaults": {
    "build": {
      "outputs": ["{projectRoot}/dist", "{projectRoot}/build"],
    },
  },
}
```

When `outputs` isn't configured, Nx uses an executor's `outputPath` option as a backward-compatible
fallback.
For `build` and `prepare` targets without an `outputPath`, Nx checks common `dist`, `build`, and
`public` directories.
For reliable caching, prefer outputs inferred by a plugin or configure `outputs` explicitly.

{% aside type="note" title="Output paths and executor options" %}
An executor's `outputPath` option doesn't automatically become part of `outputs` when `outputs` is
already configured.
Reference the option explicitly with `"outputs": ["{options.outputPath}"]` when needed.
{% /aside %}

## Configure inputs

Nx includes all files under a project root by default.
Plugins and `namedInputs` often provide more focused input sets.
You can exclude files that don't affect a target or include environment variables, runtime commands,
and external dependencies.

```jsonc title="nx.json"
{
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
    },
    "test": {
      "inputs": ["default", "^production"],
    },
  },
}
```

The `^production` input includes the `production` inputs of project dependencies.
Project-level configuration can extend or replace these values when one project needs different
hashing behavior.

```json title="packages/some-project/project.json"
{
  "name": "some-project",
  "targets": {
    "build": {
      "inputs": ["...", "!{projectRoot}/**/*.md"],
      ...
    },
    "test": {
      "inputs": [...]
    }
    ...
  }
}
```

Inputs may include the following:

- Source files that affect the task.
- Environment variables that affect the task.
- Runtime inputs that affect the task.
- Command-line arguments passed to the task.

Learn more about fine tuning caching in the [Fine-tuning Caching with Inputs page](/docs/kb/configure-inputs).

## Command-line arguments

Arguments passed to a task affect its hash because they can change the result.
For example, these commands produce different hashes:

```shell
nx build myapp
nx build myapp --sourcemap
```

Different Nx command forms that create the same task with the same task arguments produce the same
hash.
These commands are equivalent for caching:

```shell
nx build myapp
nx run-many -t build -p myapp
```

When you run a target for multiple projects, Nx calculates a separate hash for each task.
One project can be restored from cache while another project runs.

{% aside type="tip" title="Learn by doing" %}
Follow the [caching tutorial](/docs/getting-started/tutorials/caching) to inspect cache hits in a
workspace.
{% /aside %}

For setup and troubleshooting options, see [cache task results](/docs/features/cache-task-results).
