# How Caching Works

Before running any task, Nx computes its computation hash. As long as the computation hash is the same, the output of
running the task is the same.

By default, the computation hash for - say - `nx test remixapp` includes:

- All the source files of `remixapp` and its dependencies
- Relevant global configuration
- Versions of external dependencies
- Runtime values provisioned by the user such as the version of Node
- CLI Command flags

![computation-hashing](/shared/images/caching/nx-hashing.svg)

> This behavior is customizable. For instance, lint checks may only depend on the source code of the project and global
> configs. Builds can depend on the dts files of the compiled libs instead of their source.

After Nx computes the hash for a task, it then checks if it ran this exact computation before. First, it checks
locally, and then if it is missing, and if a remote cache is configured, it checks remotely.

If Nx finds the computation, Nx retrieves it and replays it. Nx places the right files in the right folders and
prints the terminal output. From the user’s point of view, the command ran the same, just a lot faster.

![cache](/shared/images/caching/cache.svg)

If Nx doesn’t find a corresponding computation hash, Nx runs the task, and after it completes, it takes the
outputs and the terminal logs and stores them locally (and if configured remotely as well). All of this happens
transparently, so you don’t have to worry about it.

Although conceptually this is fairly straightforward, Nx optimizes this to make this experience good for you. For
instance, Nx:

- Captures stdout and stderr to make sure the replayed output looks the same, including on Windows.
- Minimizes the IO by remembering what files are replayed where.
- Only shows relevant output when processing a large task graph.
- Provides affordances for troubleshooting cache misses. And many other optimizations.

As your workspace grows, the task graph looks more like this:

![cache](/shared/images/caching/task-graph-big.svg)

All of these optimizations are crucial for making Nx usable for any non-trivial workspace. Only the minimum amount of
work happens. The rest is either left as is or restored from the cache.

## Source Code Hash Inputs

The result of building/testing an application or a library depends on the source code of that project and all the source
codes of all the libraries it depends on (directly or indirectly).

By default, Nx is conservative. When running,
say, `nx run test --script=remixapp` Nx will consider all the files in the `remixapp` directory and all the files
in the `header` and `footer` directories (`remixapp` dependencies). This would result in unnecessary cache misses. For
instance, we know that changing a `footer`'s spec file will not change the result of the test command above.

We can define a more precise configuration as follows:

```json {% fileName="nx.json"%}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["!{projectRoot}/**/*.spec.tsx"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"]
    },
    "test": {
      "inputs": ["default", "^production", "{workspaceRoot}/jest.config.ts"]
    }
  }
}
```

<!-- Prettier causes the callout block to break -->
<!-- prettier-ignore-start -->

{% callout type="note" title="Special Syntax Explained" %}

- `{projectRoot}` is a key word that is replaced by the path to the current project's root directory.
- `{workspaceRoot}` is a key word that is replaced by the root path of your workspace.
- The `^` symbol means "of dependencies", i.e. `"^production"` means match the files defined for the `"production"` `namedInput`, but for all projects which the current project depends on.
- The rest of the string is parsed with the [minimatch](https://github.com/isaacs/minimatch) library
{% /callout %}
<!-- prettier-ignore-end -->

With this configuration, the build script will only consider the non-test files of `remixapp`, `header` and `footer`.
The test script will consider all the source files for the project under test and only non-test files of its
dependencies. The test script will also consider the jest config file at the root of the workspace.

For more information about modifying `inputs` and `namedInputs` for your own repo, read [Customizing Inputs](/more-concepts/customizing-inputs)

## Runtime Hash Inputs

Your targets can also depend on runtime values.

```json {% fileName="nx.json"%}
{
  "targetDefaults": {
    "build": {
      "inputs": [{ "env": "MY_ENV_NAME" }, { "runtime": "node -v" }]
    }
  }
}
```

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

## What is Cached

Nx works on the process level. Regardless of the tools used to build/test/lint/etc.. your project, the results are
cached.

Nx sets up hooks to collect stdout/stderr before running the command. All the output is cached and then replayed
during a cache hit.

Nx also caches the files generated by a command. The list of files/folders is listed in the `outputs` property of the project's `package.json`:

```json {% fileName="package.json"%}
{
  "nx": {
    "targets": {
      "build": {
        "outputs": ["{projectRoot}/build", "{projectRoot}/public/build"]
      }
    }
  }
}
```

If the `outputs` property for a given target isn't defined in the project'
s `package.json` file, Nx will look at the `targetDefaults` section of `nx.json`:

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

## Skipping Cache

Sometimes you want to skip the cache. If, for example, you are measuring the performance of a command, you can use
the `--skip-nx-cache` flag to skip checking the computation cache.

```shell
npx nx run build --skip-nx-cache
npx nx run test --skip-nx-cache
```

## Customizing the Cache Location

The cache is stored in `node_modules/.cache/nx` by default. To change the cache location, update the `cacheDirectory` option for the task runner in `nx.json`:

```json {% fileName="nx.json"%}
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "cacheableOperations": ["build", "test"],
        "cacheDirectory": "/tmp/mycache"
      }
    }
  }
}
```

## Outputs vs Output Path

Several executors have a property in `options` called `outputPath`. On its own, this property does not influence caching or what is stored at the end of a run. Frequently though, this property would point to your build artifacts. In these cases, you can include `"{options.outputPath}"` in the `outputs` array for your target to avoid duplicating the value.

The properties inside `options` are never considered for determining where artifacts are located, and are just passed into the executor when running a task. If there are artifacts that save to disk they **_must_** be included in the `outputs` array or they will not be restored when there is a cache hit for that particular target.
