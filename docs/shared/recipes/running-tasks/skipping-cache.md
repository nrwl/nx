---
title: Skip Task Caching
description: Learn how to bypass Nx's caching mechanism for specific tasks, skip remote caching from Nx Cloud, and reset the cache when needed.
---

# Skip Task Caching

There are times when you might want to bypass the [caching mechanism](/features/cache-task-results), either locally or remotely.

## Skip Caching

To skip caching for a specific task, use the `--skip-nx-cache` flag. This can be useful when you want to ensure that a task runs fresh, without using cached results.

```shell
npx nx build --skip-nx-cache
```

This will avoid using any local or remote cache.

## Skip Remote Caching from Nx Cloud

To skip remote caching provided by Nx Cloud, use the `--no-cloud` flag. This ensures that the task does not use cached results from Nx Cloud.

```shell
npx nx build --no-cloud
```

It will **still use the local cache if available**.

## Reset

To clear the cache and metadata about the workspace and shuts down the Nx Daemon you can use the [reset](/reference/core-api/nx/documents/reset) command:

```shell
npx nx reset
```
