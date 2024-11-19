---
title: Overview of the Nx powerpack-gcs-cache Plugin
description: The powerpack-gcs-cache Nx plugin enables you to use Google Cloud Storage to host your remote cache instead of Nx Cloud
---

The `@nx/powerpack-gcs-cache` plugin enables you to use [Google Cloud Storage](https://cloud.google.com/storage) instead of Nx Cloud to host your remote cache.

This plugin will enable the remote cache for your Nx workspace, but does not provide any of the other features of Nx Cloud. If you want to leverage [distributed task execution](/ci/features/distribute-task-execution), [re-running flaky tasks](/ci/features/flaky-tasks) or [automatically splitting tasks](/ci/features/split-e2e-tasks), you'll need to [connect to Nx Cloud](/ci/intro/connect-to-nx-cloud) and use [Nx Replay](/ci/features/remote-cache) instead.

{% callout type="warning" title="Potential Cache Poisoning" %}
Using your own Google Cloud Storage account to host the remote cache opens you up to the possibility of [cache poisoning](/troubleshooting/unknown-local-cache). To avoid this, use [Nx Replay](/ci/features/remote-cache).
{% /callout %}

{% callout title="This plugin requires an active Nx Powerpack license" %}
In order to use `@nx/powerpack-gcs-cache`, you need to have an active Powerpack license. If you don't have a license or it has expired, your cache will no longer be shared and each machine will use its local cache.
{% /callout %}

## Set Up @nx/powerpack-gcs-cache

### 1. Install the Package

1. [Activate Powerpack](/nx-enterprise/activate-powerpack) if you haven't already
2. Install the package

```shell
nx add @nx/powerpack-gcs-cache
```

### 2. Authenticate with Google Cloud

There are several ways to [authenticate with Google Cloud Storage](https://github.com/google-github-actions/setup-gcloud#authorization), but the method recommended by Google is to use Workload Identity Federation, like this:

```yaml {% fileName=".github/workflows/ci.yml" %}
name: CI
...
permissions:
  id-token: write
  ...

jobs:
  main:
    env:
      NX_POWERPACK_LICENSE: ${{ secrets.NX_POWERPACK_LICENSE }}
    runs-on: ubuntu-latest
    steps:
        ...

      - id: 'auth'
        name: 'Authenticate to Google Cloud'
        uses: 'google-github-actions/auth@v2'
        with:
          token_format: 'access_token'
          workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/my-pool/providers/my-provider'
          service_account: 'my-service-account@my-project.iam.gserviceaccount.com'

      - name: 'Set up Cloud SDK'
        uses: 'google-github-actions/setup-gcloud@v2'
        with:
          version: '>= 363.0.0'

        ...

      - run: pnpm exec nx affected -t lint test build
```

Note: Any authentication method that [sets up the Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials) will enable the plugin to work.

### 3. Configure the Nx Cache to Use Google Cloud Storage

Finally, you need to configure your Nx cache in the `nx.json` file. The `bucket` that you specify needs to already exist - Nx doesn't create it for you.

```jsonc {% fileName="nx.json" %}
{
  "gcs": {
    "bucket": "my-bucket"
  }
}
```

| **Property** | **Description**               |
| ------------ | ----------------------------- |
| **bucket**   | The name of the bucket to use |
