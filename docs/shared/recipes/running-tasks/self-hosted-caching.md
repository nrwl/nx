---
title: 'Self-Host your Remote Cache'
description: 'Learn how to self-host Nx remote caching on AWS S3, Google Cloud, Azure, or shared drives, or build your own cache server for enhanced build performance in your monorepo.'
---

# Self-Host your Remote Cache

Nx offers different ways to enable self-hosted remote caching for your workspace that can be used starting with Nx version 19.8 and higher:

- **Using the official Nx packages** that come with ready-to-use adapters for AWS S3, GCP, Azure, and more.
- **Build your own cache server** by following the Nx Remote Caching OpenAPI spec.

{% callout type="note" title="Free managed remote cache with Nx Cloud" %}

Note, you can get started for free with a **fully managed remote caching powered by Nx Cloud**. It comes with a generous Hobby plan that is enough for most small teams. [Learn more here](/nx-cloud).

If you are an enterprise and **data privacy and security is a concern**, [reach out for an Enterprise trial](/enterprise/trial). It is fully SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise.

**Are you an OSS project?** Nx Cloud is free for OSS. [Reach out here](/pricing#oss).

{% /callout %}

## Official Nx Self-Hosted Cache Packages

The official self-hosted cache packages are the easiest migration path if you've been using a community caching solution based on the old custom task runner API in the past. All of the packages are completely free but require an activation key. Getting a key is a fully automated and self-serving process that happens during the package installation.

The following remote cache adapters are available:

- [@nx/s3-cache](/nx-api/s3-cache): Cache is self-hosted on an Amazon S3 bucket
- [@nx/gcs-cache](/nx-api/gcs-cache): Cache is self-hosted on Google Cloud storage
- [@nx/azure-cache](/nx-api/azure-cache): Cache is self-hosted on Azure
- [@nx/shared-fs-cache](/nx-api/shared-fs-cache): Cache is self-hosted on a shared file system location

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also [build your own cache server](#build-your-own-caching-server).

### Migrating From Custom Tasks Runners

You might have used Nx's now deprecated custom task runners API in the following scenarios:

- to implement custom self-hosted caching: going forward, use the official self-hosted packages or alternatively [build your own caching server](#build-your-own-caching-server)
- to inject custom behavior before and after running tasks in Nx: for that purpose, we've built a new API exposing dedicated pre and post hooks.

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).

## Build Your Own Caching Server

We have [published a new RFC](https://github.com/nrwl/nx/discussions/30548) detailing a custom self-hosted cache based on an OpenAPI specification. This will be available before Nx 21, ensuring a smooth migration path for those who are looking for full control.

## Why Switch to Nx Cloud

Nx Cloud is much more than just a remote caching solution; it provides a full platform for scaling monorepos on CI. It comes with:

- [fully managed remote caching with Nx Replay](/ci/features/remote-cache)
- [automated distribution of tasks across machines with Nx Agents](/ci/features/distribute-task-execution)
- [automated splitting of tasks (including e2e tests) with Nx Atomizer](/ci/features/split-e2e-tasks)
- [detection and re-running of flaky tasks](/ci/features/flaky-tasks)

{% call-to-action title="Connect to Nx Cloud" icon="nxcloud" description="Enable task distribution and Atomizer" url="/ci/intro/connect-to-nx-cloud" /%}
