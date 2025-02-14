# Self-Host the Remote Cache

{% youtube src="https://youtu.be/vRGAa5SuiTM" title="Nx Powerpack self-hosted cache storage" /%}

The recommended way to enable the [remote cache](/ci/features/remote-cache) is to use Nx Replay and have Nx Cloud share the task cache across your organization. For those organizations that are unable to use Nx Cloud, Nx offers official plugins that are enabled by [Nx Powerpack](/powerpack) to self-host the remote cache in a fast and secure manner. Powerpack is available for Nx version 19.8 and higher. The recommended ways to host the remote cache are, in order of preference:

1. [Nx Replay](/ci/features/remote-cache): Cache is hosted on Nx Cloud servers or on-premise with an [Nx Enterprise](/enterprise) contract
2. [@nx/powerpack-s3-cache](/nx-api/powerpack-s3-cache): Cache is self-hosted on an Amazon S3 bucket
3. [@nx/powerpack-gcs-cache](/nx-api/powerpack-gcs-cache): Cache is self-hosted on Google Cloud storage
4. [@nx/powerpack-azure-cache](/nx-api/powerpack-azure-cache): Cache is self-hosted on Azure
5. [@nx/powerpack-shared-fs-cache](/nx-api/powerpack-shared-fs-cache): Cache is self-hosted on a shared file system location

The options range from fully opting in to Nx's management of the remote cache to fully managing the configuration and security of your own remote cache.

## Migrating from Custom Tasks Runners

Many people who are interested in Nx Powerpack have previously used custom task runners. Nx offers a new and simpler extension API designed to meet the same use cases as the now-deprecated custom task runners.

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).

## Setup

All the self-hosted cache storage plugins require an Nx Powerpack license to function. [Activating Powerpack](/nx-enterprise/activate-powerpack) is a simple process.

{% call-to-action title="Get a License and Activate Powerpack" icon="nx" description="Unlock all the features of the Nx CLI" url="/nx-enterprise/activate-powerpack" /%}

Then, choose the appropriate cache plugin for your situation.

{% cards cols="2" lgCols="2" mdCols="2" smCols="2" %}

{% link-card title="Amazon S3 Bucket Remote Cache" type="Nx Plugin" url="/nx-api/powerpack-s3-cache" icon="AmazonS3Icon" /%}
{% link-card title="Google Cloud Storage Remote Cache" type="Nx Plugin" url="/nx-api/powerpack-gcs-cache" icon="GoogleCloudIcon" /%}
{% link-card title="Azure Remote Cache" type="Nx Plugin" url="/nx-api/powerpack-azure-cache" icon="AzureDevOpsIcon" /%}
{% link-card title="Shared Network Drive Remote Cache" type="Nx Plugin" url="/nx-api/powerpack-shared-fs-cache" icon="ServerIcon" /%}

{% /cards %}

## Switch to Nx Cloud

These custom remote cache storage solutions only provide the remote cache functionality of Nx Cloud. If you want to leverage [distributed task execution](/ci/features/distribute-task-execution), [re-running flaky tasks](/ci/features/flaky-tasks) or [automatically splitting tasks](/ci/features/split-e2e-tasks), you'll need to [connect to Nx Cloud](/ci/intro/connect-to-nx-cloud) and use Nx Cloud's remote cache solution instead.

{% call-to-action title="Connect to Nx Cloud" icon="nxcloud" description="Enable task distribution and Atomizer" url="/ci/intro/connect-to-nx-cloud" /%}
