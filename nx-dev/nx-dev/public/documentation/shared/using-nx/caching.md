# Computation Caching

> Before reading this guide, check out the [mental model guide](/using-nx/mental-model). It will help you understand how computation caching fits into the rest of Nx.

## Overview

It's costly to rebuild and retest the same code over and over again. Nx uses a computation cache to never rebuild the same code twice. This is how it does it:

Before running any task, Nx computes its computation hash. As long as the computation hash is the same, the output of running the task is the same.

By default, the computation hash for say `nx test app1` includes:

- All the source files of `app1` and its dependencies
- Relevant global configuration
- Versions of externals dependencies
- Runtime values provisioned by the user such as the version of Node
- Command flags

![computation-hashing](/shared/mental-model/computation-hashing.png)

This behavior is customizable. For instance, lint checks may only depend on the source code of the project and global
configs. Builds can depend on the dts files of the compiled libs instead of their source.

After Nx computes the hash for a task, it then checks if it ran this exact computation before. First, it checks locally,
and then if it is missing, and if a remote cache is configured, it checks remotely.

If Nx finds the computation, Nx retrieves it and replay it. Nx places the right files in the right folders and prints
the terminal output. So from the user’s point of view, the command ran the same, just a lot faster.

![cache](/shared/mental-model/cache.png)

If Nx doesn’t find this computation, Nx runs the task, and after it completes, it takes the outputs and the terminal
output and stores it locally (and if configured remotely). All of this happens transparently, so you don’t have to worry
about it.

Although conceptually this is fairly straightforward, Nx optimizes this to make this experience good for you. For
instance, Nx:

- Captures stdout and stderr to make sure the replayed output looks the same, including on Windows.
- Minimizes the IO by remembering what files are replayed where.
- Only shows relevant output when processing a large task graph.
- Provides affordances for troubleshooting cache misses. And many other optimizations.

As your workspace grows, the task graph looks more like this:

![cache](/shared/mental-model/task-graph-big.png)

All of these optimizations are crucial for making Nx usable for any non-trivial workspace. Only the minimum amount of
work happens. The rest is either left as is or restored from the cache.

## Source Code Hash Inputs

The result of building/testing an application or a library depends on the source code of that project and all the source codes of all the libraries it depends on (directly or indirectly). It also depends on the configuration files like `package.json`, `workspace.json`, `nx.json`, `tsconfig.base.json`, and `package-lock.json`. The list of these files isn't arbitrary. Nx can deduce most of them by analyzing our codebase. Few have to be listed manually in the `implicitDependencies` property of `nx.json`.

```json
{
  "npmScope": "happyorg",
  "implicitDependencies": {
    "global-config-file.json": "*"
  },
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "cacheableOperations": ["build", "test", "lint", "e2e"]
      }
    }
  }
}
```

## Runtime Hash Inputs

All commands listed in `runtimeCacheInputs` are invoked by Nx, and the results are included into the computation hash of each task.

```json
{
  "npmScope": "happyorg",
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "cacheableOperations": ["build", "test", "lint", "e2e"],
        "runtimeCacheInputs": ["node -v", "echo $IMPORTANT_ENV_VAR"]
      }
    }
  }
}
```

Sometimes the amount of _runtimeCacheInputs_ can be too overwhelming and difficult to read or parse. In this case, we
recommend creating a `SHA` from those inputs. It can be done like the following:

```json
{
  "npmScope": "happyorg",
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "cacheableOperations": ["build", "test", "lint", "e2e"],
        "runtimeCacheInputs": [
          "node -v",
          "echo $IMPORTANT_ENV_VAR",
          "echo $LONG_IMPORTANT_ENV_VAR | sha256sum",
          "cat path/to/my/big-list-of-checksums.txt | sha256sum"
        ]
      }
    }
  }
}
```

## Args Hash Inputs

Finally, in addition to Source Code Hash Inputs and Runtime Hash Inputs, Nx needs to consider the arguments: For example, `nx build shop` and `nx build shop --prod` produce different results.

Note, only the flags passed to the executor itself affect results of the computation. For instance, the following commands are identical from the caching perspective.

```bash
nx build myapp --prod
nx build myapp --configuration=production
nx run-many --target=build --projects=myapp --configuration=production
nx run-many --target=build --projects=myapp --configuration=production --parallel
nx affected:build # given that myapp is affected
```

In other words, Nx does not cache what the developer types into the terminal. The args cache inputs consist of: Project Name, Target, Configuration + Args Passed to Executors.

If you build/test/lint… multiple projects, each individual build has its own hash value and is either be retrieved from cache or run. This means that from the caching point of view, the following command:

```bash
nx run-many --target=build --projects=myapp1,myapp2
```

is identical to the following two commands:

```bash
nx build myapp1
nx build myapp2
```

## What is Cached

Nx works on the process level. Regardless of the tools used to build/test/lint/etc.. your project, the results is cached.

Nx sets up hooks to collect stdout/stderr before running the command. All the output is cached and then replayed during a cache hit.

Nx also caches the files generated by a command. The list of folders is listed in the `outputs` property.

```json
{
  "projects": {
    "myapp": {
      "root": "apps/myapp/",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "architect": {
        "build": {
          "builder": "@nrwl/js:tsc",
          "outputs": ["dist/apps/myapp"],
          "options": {
            "main": "apps/myapp/src/index.ts"
          }
        }
      }
    }
  }
}
```

If the `outputs` property is missing, Nx defaults to caching the appropriate folder in the dist (`dist/apps/myapp` for `myapp` and `dist/libs/somelib` for `somelib`).

## Skipping Cache

Sometimes you want to skip the cache, such as if you are measuring the performance of a command. Use the `--skip-nx-cache` flag to skip checking the computation cache.

```bash
nx build myapp --skip-nx-cache
nx affected --target=build --skip-nx-cache
```

## Customizing the Cache Location

The cache is stored in `node_modules/.cache/nx` by default. To change the cache location, update the `cacheDirectory` option for the task runner:

```json
{
  "npmScope": "happyorg",
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "cacheableOperations": ["build", "test", "lint", "e2e"],
        "cacheDirectory": "/tmp/nx"
      }
    }
  }
}
```

## Local Computation Caching

By default, Nx uses a local computation cache. Nx stores the cached values only for a week, after which they are deleted. To clear the cache run `nx reset`, and Nx creates a new one the next time it tries to access it.

## Distributed Computation Caching

The computation cache provided by Nx can be distributed across multiple machines. Nx Cloud is a product that allows you to share the results of running build/test with everyone else working in the same workspace. Learn more at [https://nx.app](https://nx.app).

You can connect your workspace to Nx Cloud by running:

```bash
nx connect-to-nx-cloud
```

You can also distribute the cache manually using your own storage mechanisms.

## Example

- [This is an example repo](https://github.com/vsavkin/large-monorepo) benchmarking Nx's computation caching. It also explains why Nx's computation caching tends to be a lot faster than the caching of other build systems.
