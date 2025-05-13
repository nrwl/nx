---
title: How Caching Works
description: Learn how Nx's computation hashing enables powerful caching, including what factors determine cache validity and how local and remote caches work together.
---

# How Caching Works

Before running any cacheable task, Nx computes its computation hash. As long as the computation hash is the same, the output of
running the task is the same.

By default, the computation hash for something like `nx test remixapp` includes:

- All the source files of `remixapp` and its dependencies
- Relevant global configuration
- Versions of external dependencies
- Runtime values provisioned by the user such as the version of Node
- CLI Command flags

![computation-hashing](/shared/images/caching/nx-hashing.svg)

> This behavior is customizable. For instance, lint checks may only depend on the source code of the project and global
> configs. Builds can depend on the dts files of the compiled libs instead of their source.

After Nx computes the hash for a task, it then checks if it ran this exact computation before. First, it checks locally, and then if it is missing, and if a remote cache is configured, it checks remotely. If a matching computation is found, Nx retrieves and replays it. This includes restoring files.

Nx places the right files in the right folders and prints the terminal output. From the user's point of view, the command ran the same, just a lot faster.

![cache](/shared/images/caching/cache.svg)

If Nx doesn't find a corresponding computation hash, Nx runs the task, and after it completes, it takes the outputs and the terminal logs and stores them locally (and, if configured, remotely as well). All of this happens transparently, so you don't have to worry about it.

## Optimizations

Although conceptually this is fairly straightforward, Nx optimizes the experience for you. For instance, Nx:

- Captures stdout and stderr to make sure the replayed output looks the same, including on Windows.
- Minimizes the IO by remembering what files are replayed where.
- Only shows relevant output when processing a large task graph.
- Provides affordances for troubleshooting cache misses. And many other optimizations.

As your workspace grows, the task graph looks more like this:

![cache](/shared/images/caching/task-graph-big.svg)

All of these optimizations are crucial for making Nx usable for any non-trivial workspace. Only the minimum amount of
work happens. The rest is either left as is or restored from the cache.

## Fine-tuning Nx's Cache

Each cacheable task defines a set of inputs and outputs. Inputs are factors Nx considers when calculating the computation hash.
Outputs are files that will be cached and restored when the computation hash matches.
For more information on how to fine-tune caching, see the [Fine-tuning Caching with Inputs recipe](/recipes/running-tasks/configure-inputs).

### Inputs

Inputs are factors Nx considers when calculating the computation hash for a task.

For more information on the different types of inputs and how to configure inputs for your tasks, read the [Fine-tuning Caching with Inputs recipe](/recipes/running-tasks/configure-inputs)

## What is Cached

Nx cache works on the process level. Regardless of the tools used to build/test/lint/etc.. your project, the results are cached. This includes:

- **Terminal output:** The terminal output generated when running a task. This includes logs, warnings, and errors.
- **Task artifacts:** The output files of a task defined in the [`outputs` property of your project configuration](/recipes/running-tasks/configure-outputs). For example the build output, test results, or linting reports.
- **Hash:** The hash of the inputs to the computation. The inputs include the source code, runtime values, and command line arguments. Note that the hash is included in the cache, but the actual inputs are not.

{% tabs %}
{% tab label="package.json" %}

```json {% fileName="apps/myapp/package.json"%}
{
  "name": "myapp",
  "dependencies": {},
  "devDependencies": {},
  "nx": {
    "targets": {
      "build": {
        "outputs": ["{projectRoot}/build", "{projectRoot}/public/build"]
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="apps/myapp/project.json"%}
{
  "name": "myapp",
  ...
  "targets": {
    "build": {
      ...
      "outputs": ["dist/dist/myapp"]
    }
  }
}
```

{% /tab %}

If the `outputs` property for a given target isn't defined in the project's `package.json` file, Nx will look at the global, workspace-wide definition in the `targetDefaults` section of `nx.json`:

```jsonc {% fileName="nx.json"%}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": [
        "^build"
      ],
      "outputs": [
        "{projectRoot}/dist",
        "{projectRoot}/build",
        "{projectRoot}/public/build"
      ]
    }
  }
}
```

If neither is defined, Nx defaults to caching `dist` and `build` at the root of the repository.

{% callout title="Output vs OutputPath" type="info" %}

Several executors have a property in options called `outputPath`. On its own, this property does not influence caching or what is stored at the end of a run. You can reuse that property though by defining your outputs like: `outputs: [{options.outputPath}]`.

{% /callout %}

## Define Cache Inputs

By default the cache considers all project files (e.g. `{projectRoot}/**/*`). This behavior can be customized by defining in a much more fine-grained way what files should be included or excluded for each target.

{% tabs %}
{% tab label="Globally" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "inputs": ["{projectRoot}/**/*", "!{projectRoot}/**/*.md"]
      ...
    },
    "test": {
      "inputs": [...]
    }
  }
}
```

{% /tab %}
{% tab label="Project Level" %}

```json {% fileName="packages/some-project/project.json"  %}
{
  "name": "some-project",
  "targets": {
    "build": {
      "inputs": ["!{projectRoot}/**/*.md"],
      ...
    },
    "test": {
      "inputs": [...]
    }
    ...
  }
}
```

{% /tab %}

Inputs may include

- source files
- environment variables
- runtime inputs
- command line arguments

Learn more about fine tuning caching in the [Fine-tuning Caching with Inputs page](/recipes/running-tasks/configure-inputs).

## Args Hash Inputs

Finally, in addition to Source Code Hash Inputs and Runtime Hash Inputs, Nx needs to consider the arguments: For
example, `nx build remixapp` and `nx build remixapp -- --flag=true` produce different
results.

Note, only the flags passed to the npm scripts itself affect results of the computation. For instance, the following
commands are identical from the caching perspective.

```shell
npx nx build remixapp
npx nx run-many -t build -p remixapp
```

In other words, Nx does not cache what the developer types into the terminal.

If you build/test/lint… multiple projects, each individual build has its own hash value and will either be retrieved
from
cache or run. This means that from the caching point of view, the following command:

```shell
npx nx run-many -t build -p header footer
```

is identical to the following two commands:

```shell
npx nx build header
npx nx build footer
```

## Next steps

Learn more about how to configure caching, where the cache is stored, how to reset it and more.

- [Cache Task Results](/features/cache-task-results)
