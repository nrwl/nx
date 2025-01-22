---
title: Overview of the Nx powerpack-azure-cache Plugin
description: The powerpack-azure-cache Nx plugin enables you to use Azure Storage to host your remote cache instead of Nx Cloud
---

The `@nx/powerpack-azure-cache` plugin enables you to use [Azure Storage](https://azure.microsoft.com/en-us/products/storage/blobs) instead of Nx Cloud to host your remote cache.

This plugin will enable the remote cache for your Nx workspace, but does not provide any of the other features of Nx Cloud. If you want to leverage [distributed task execution](/ci/features/distribute-task-execution), [re-running flaky tasks](/ci/features/flaky-tasks) or [automatically splitting tasks](/ci/features/split-e2e-tasks), you'll need to [connect to Nx Cloud](/ci/intro/connect-to-nx-cloud) and use [Nx Replay](/ci/features/remote-cache) instead.

{% callout title="This plugin requires an active Nx Powerpack license" %}
In order to use `@nx/powerpack-azure-cache`, you need to have an active Powerpack license. If you don't have a license or it has expired, your cache will no longer be shared and each machine will use its local cache.
{% /callout %}

## Set Up @nx/powerpack-azure-cache

### 1. Install the Package

1. [Activate Powerpack](/nx-enterprise/activate-powerpack) if you haven't already. It only takes a minute.
2. Install the package

```shell
nx add @nx/powerpack-azure-cache
```

### 2. Authenticate with Azure

There are several ways to [authenticate with Azure Storage](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended), but the method recommended by Azure is to use OpenID Connect, like this:

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

      - name: Azure login
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
        ...

      - run: pnpm exec nx affected -t lint test build
```

You need to set the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` secrets as defined in the [Azure documentation](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended).

Note: Any authentication method that [sets up the `DefaultAzureCredentials`](https://learn.microsoft.com/en-us/azure/developer/javascript/sdk/credential-chains#use-defaultazurecredential-for-flexibility) will enable the plugin to work.

{% callout type="note" title="Custom Azure Endpoint" %}
If you are using a custom Azure endpoint, you will need to authenticate by [setting the `AZURE_STORAGE_CONNECTION_STRING` environment variable](https://learn.microsoft.com/en-us/azure/storage/common/storage-configure-connection-string). The `@nx/powerpack-azure-cache` plugin will detect the environment variable and automatically use it to connect to Azure.
{% /callout %}

### 3. Configure the Nx Cache to Use Azure Storage

Finally, you need to configure your Nx cache in the `nx.json` file. The `container` that you specify needs to already exist - Nx doesn't create it for you.

```jsonc {% fileName="nx.json" %}
{
  "azure": {
    "container": "mycontainer",
    "accountName": "myaccount"
  }
}
```

| **Property**    | **Description**                  |
| --------------- | -------------------------------- |
| **container**   | The name of the container to use |
| **accountName** | The name of blob storage account |

### Migrating from Custom Tasks Runners

Many people who are interested in Nx Powerpack have previously used custom task runners. Nx offers a new and simpler extension API designed to meet the same use cases as the now-deprecated custom task runners.

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).

# Cache Modes

By default, Nx will try to write and read from the remote cache while running locally. This means that permissions must be set for users who are expected to access the remote cache.

Nx will only show warnings when the remote cache is not writable. You can disable these warnings by setting `localMode` to `read-only` or `no-cache` in the `nx.json` file.

```jsonc {% fileName="nx.json" %}
{
  "azure": {
    // ...
    "localMode": "read-only"
  }
}
```

The cache mode in CI can also be configured by setting `ciMode` to `read-only` or `no-cache` in the `nx.json` file. Or setting `NX_POWERPACK_CACHE_MODE` to `read-only` or `no-cache` in the CI environment.

```jsonc {% fileName="nx.json" %}
{
  "azure": {
    // ...
    "ciMode": "read-only"
  }
}
```
