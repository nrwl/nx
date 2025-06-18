---
title: Overview of the Nx Shared File System Cache Plugin
description: The @nx/shared-fs-cache plugin enables you to use a shared file system directory to host your remote cache for efficient build caching across your team.
---

# @nx/shared-fs-cache

The `@nx/shared-fs-cache` plugin enables you to host your remote cache on a shared file system directory. While you're responsible for implementing the actual directory sharing mechanism, the plugin configures Nx to read from both your local cache and the shared directory.

{% callout type="deepdive" title="Free managed remote cache with Nx Cloud" %}

Note, you can get started for free with a **fully managed remote caching powered by Nx Cloud**. It comes with a generous Hobby plan that is enough for most small teams. [Learn more here](/nx-cloud).

If you are an enterprise and **data privacy and security is a concern**, [reach out for an Enterprise trial](/enterprise/trial). It is fully SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise.

**Are you an OSS project?** Nx Cloud is free for OSS. [Reach out here](/pricing#oss).

{% /callout %}

{% callout type="warning" title="Bucket-based caches are vulnerable to poisoning and often prohibited in organizations" %}

CREEP (CVE-2025-36852) is a critical vulnerability in bucket-based self-hosted remote caches. It lets attackers with PR access poison production builds via a race condition during artifact creation—before security checks can catch it. [Learn more](/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep)

{% /callout %}

## Set Up @nx/shared-fs-cache

### 1. Install the Package

Run the following command:

```shell
nx add @nx/shared-fs-cache
```

This will add the `@nx/shared-fs-cache` NPM package and automatically configure it for your workspace. As part of this process, you'll be guided to **generate a new activation key**. This is a fully automated process to register your plugin.

The key will be saved in your repository (`.nx/key/key.ini`) and should be committed so that every developer has access to it. If your repository is public (or in CI), you can also use an environment variable:

```{% fileName=".env" %}
NX_KEY=YOUR_ACTIVATION_KEY
```

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also build your own cache server. [Learn more.](/recipes/running-tasks/self-hosted-caching)

### 2. Configure the Cache Directory

The `@nx/shared-fs-cache` plugin treats your local cache directory as if it is also a remote cache directory. The local cache directory can be set using `cacheDirectory` in the `nx.json` file or the `NX_CACHE_DIRECTORY` environment variable. The default local cache directory is `.nx/cache`.

### 3. Share the Cache Directory

The `@nx/shared-fs-cache` plugin does not actually share the cache directory across your organization. You are responsible for enabling the actual sharing mechanism. If you want Nx to handle the sharing, use [Nx Replay](/ci/features/remote-cache) instead. Your shared file system directory might be a directory that is saved and restored by a CI provider or it could be a shared network drive.
