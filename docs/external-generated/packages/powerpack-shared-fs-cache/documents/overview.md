---
title: Overview of the Nx powerpack-shared-fs-cache Plugin
description: The powerpack-shared-fs-cache Nx plugin enables you to use an shared file system directory instead of Nx Cloud to host your remote cache
---

The `@nx/powerpack-shared-fs-cache` plugin enables you to use an shared file system directory instead of Nx Cloud to host your remote cache. You are responsible for the sharing mechanism for the directory, but the plugin ensures that Nx correctly associates task metadata with the file artifacts.

{% callout type="warning" title="Potential Cache Poisoning" %}
Using a shared file system folder for the remote cache opens you up to the possibility of [cache poisoning](/troubleshooting/unknown-local-cache). To avoid this, use [Nx Replay](/ci/features/remote-cache) or share your cache with an AWS S3 bucket using [`@nx/powerpack-s3-cache`](/nx-api/powerpack-s3-cache).
{% /callout %}

{% callout title="This plugin requires an active Nx Powerpack license" %}
In order to use `@nx/powerpack-shared-fs-cache`, you need to have an active Powerpack license. If you don't have a license or it has expired, your cache will no longer be shared and each machine will use its local cache.
{% /callout %}

## Setup

### 1. Install the Package

1. [Activate Powerpack](/recipes/installation/activate-powerpack) if you haven't already
2. Install the package

```shell
nx add @nx/powerpack-shared-fs-cache
```

### 2. Configure the Cache Directory

The `@nx/powerpack-shared-fs-cache` plugin treats your local cache directory as if it is also a remote cache directory. The local cache directory can be set using `cacheDirectory` in the `nx.json` file or the `NX_CACHE_DIRECTORY` environment variable. The default local cache directory is `.nx/cache`

### 3. Share the Cache Directory

The `@nx/powerpack-shared-fs-cache` plugin does not actually share the cache directory across your organization. If you want that functionality, use [Nx Replay](/ci/features/remote-cache) instead. Your shared file system directory might be a directory that is saved and restored by a CI provider or it could be a shared network drive.
