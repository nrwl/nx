# Change the Remote Cache Storage Location

The recommended way to enable the [remote cache]() is to use [Nx Replay]() and have Nx Cloud share the task cache across your organization. For those organizations that are unable to use Nx Cloud, Nx offers official plugins that are enabled by [Nx Powerpack]() to customize your remote cache location in a fast and secure manner.

In Nx 20, the local cache mechanism is getting faster and more secure by storing the cache in a database instead of directly on the file system. The new cache is faster because it avoids the unavoidably slow speed of interacting with the file system. The new cache is more secure because it eliminates the possibility that other processes with file system access could read or modify the cache. The [`@nx/powerpack-s3-cache`](/nx-api/powerpack-s3-cache) and [`@nx/powerpack-shared-fs-cache`]() plugins enable you to leverage that speed and security with a custom remote cache storage location.

{% callout type="note" title="Custom Task Runners are Deprecated in Nx 20" %}
If you have a custom coded method for changing the remote cache location that uses either `tasksRunnerOptions` or `cacheDirectory`, you'll need to choose a migration path. Those properties are [deprecated in Nx 20](/deprecated/custom-task-runners) and will be removed in Nx 21.
{% /callout %}

## Custom Remote Cache Storage Plugins Require Nx Powerpack

The `@nx/powerpack-s3-cache` and `@nx/powerpack-shared-fs-cache` plugins require an Nx Powerpack license to function. [Activating Powerpack](/recipes/installation/activate-powerpack) is a simple process.

{% call-to-action title="Buy a Powerpack License" icon="nx" description="Unlock all the features of Nx" url="https://nx.app/nx-powerpack/purchase" /%}

## Choose Your Storage Solution

Read the individual plugin documentation for specific set up instructions.

{% cards cols="2" lgCols="2" mdCols="2" smCols="2" %}

{% link-card title="AWS S3 Bucket Remote Cache" type="Nx Plugin" url="/nx-api/powerpack-s3-cache" icon="aws" /%}

{% link-card title="Shared Network Drive Remote Cache" type="Nx Plugin" url="/nx-api/powerpack-s3-cache" icon="network" /%}

{% /cards %}

## Switch to Nx Cloud

These custom remote cache storage solutions only provide the remote cache functionality of Nx Cloud. If you want to leverage [distributed task execution](), [re-running flaky tasks]() or [automatically splitting tasks](), you'll need to [connect to Nx Cloud]() and use Nx Cloud's remote cache solution instead.

{% call-to-action title="Connect to Nx Cloud" icon="nxcloud" description="Enable task distribution and Atomizer" url="/ci/intro/connect-to-nx-cloud" /%}
