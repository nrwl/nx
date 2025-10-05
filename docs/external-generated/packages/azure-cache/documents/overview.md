---
title: Overview of the Nx Azure Cache Plugin
description: The @nx/azure-cache plugin enables you to use Azure Storage to host your remote cache for efficient build caching across your team.
---

# @nx/azure-cache

The `@nx/azure-cache` plugin enables you to self-host your remote cache on [Azure Storage](https://azure.microsoft.com/en-us/products/storage/blobs).

{% callout type="deepdive" title="Free managed remote cache with Nx Cloud" %}

Note, you can get started for free with a **fully managed remote caching powered by Nx Cloud**. It comes with a generous Hobby plan that is enough for most small teams. [Learn more here](/nx-cloud).

If you are an enterprise and **data privacy and security is a concern**, [reach out for an Enterprise trial](/enterprise/trial). It is fully SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise.

**Are you an OSS project?** Nx Cloud is free for OSS. [Reach out here](/pricing#oss).

{% /callout %}

{% callout type="warning" title="Bucket-based caches are vulnerable to poisoning and often prohibited in organizations" %}

CREEP (CVE-2025-36852) is a critical vulnerability in bucket-based self-hosted remote caches. It lets attackers with PR access poison production builds via a race condition during artifact creation—before security checks can catch it. [Learn more](/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep)

{% /callout %}

## Set Up @nx/azure-cache

### 1. Install the Package

Run the following command:

```shell
nx add @nx/azure-cache
```

This will add the `@nx/azure-cache` NPM package and automatically configure it for your workspace. As part of this process, you'll be guided to **generate a new activation key**. This is a fully automated process to register your plugin.

The key will be saved in your repository (`.nx/key/key.ini`) and should be committed so that every developer has access to it. If your repository is public (or in CI), you can also use an environment variable:

```{% fileName=".env" %}
NX_KEY=YOUR_ACTIVATION_KEY
```

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also build your own cache server. [Learn more.](/recipes/running-tasks/self-hosted-caching)

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
      NX_KEY: ${{ secrets.NX_KEY }}
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
If you are using a custom Azure endpoint, you will need to authenticate by [setting the `AZURE_STORAGE_CONNECTION_STRING` environment variable](https://learn.microsoft.com/en-us/azure/storage/common/storage-configure-connection-string). The `@nx/azure-cache` plugin will detect the environment variable and automatically use it to connect to Azure.
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
