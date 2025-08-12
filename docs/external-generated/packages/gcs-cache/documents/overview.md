---
title: Overview of the Nx GCS Cache Plugin
description: The @nx/gcs-cache plugin enables you to use Google Cloud Storage to host your remote cache for efficient build caching across your team.
---

# @nx/gcs-cache

The `@nx/gcs-cache` plugin enables you to self-host your remote cache on [Google Cloud Storage](https://cloud.google.com/storage).

{% callout type="deepdive" title="Free managed remote cache with Nx Cloud" %}

Note, you can get started for free with a **fully managed remote caching powered by Nx Cloud**. It comes with a generous Hobby plan that is enough for most small teams. [Learn more here](/nx-cloud).

If you are an enterprise and **data privacy and security is a concern**, [reach out for an Enterprise trial](/enterprise/trial). It is fully SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise.

**Are you an OSS project?** Nx Cloud is free for OSS. [Reach out here](/pricing#oss).

{% /callout %}

{% callout type="warning" title="Bucket-based caches are vulnerable to poisoning and often prohibited in organizations" %}

CREEP (CVE-2025-36852) is a critical vulnerability in bucket-based self-hosted remote caches. It lets attackers with PR access poison production builds via a race condition during artifact creation—before security checks can catch it. [Learn more](/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep)

{% /callout %}

## Set Up @nx/gcs-cache

### 1. Install the Package

Run the following command:

```shell
nx add @nx/gcs-cache
```

This will add the `@nx/gcs-cache` NPM package and automatically configure it for your workspace. As part of this process, you'll be guided to **generate a new activation key**. This is a fully automated process to register your plugin.

The key will be saved in your repository (`.nx/key/key.ini`) and should be committed so that every developer has access to it. If your repository is public (or in CI), you can also use an environment variable:

```{% fileName=".env" %}
NX_KEY=YOUR_ACTIVATION_KEY
```

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also build your own cache server. [Learn more.](/recipes/running-tasks/self-hosted-caching)

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
      NX_KEY: ${{ secrets.NX_KEY }}
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

### Migrating from Custom Tasks Runners

Many people who are interested in Nx Powerpack have previously used custom task runners. Nx offers a new and simpler extension API designed to meet the same use cases as the now-deprecated custom task runners.

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).

# Cache Modes

By default, Nx will try to write and read from the remote cache while running locally. This means that permissions must be set for users who are expected to access the remote cache.

Nx will only show warnings when the remote cache is not writable. You can disable these warnings by setting `localMode` to `read-only` or `no-cache` in the `nx.json` file.

```jsonc {% fileName="nx.json" %}
{
  "gcs": {
    // ...
    "localMode": "read-only"
  }
}
```

The cache mode in CI can also be configured by setting `ciMode` to `read-only` or `no-cache` in the `nx.json` file. Or by setting `NX_POWERPACK_CACHE_MODE` to `read-only` or `no-cache` in the CI environment.

```jsonc {% fileName="nx.json" %}
{
  "gcs": {
    // ...
    "ciMode": "read-only"
  }
}
```
