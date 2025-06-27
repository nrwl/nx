---
title: Overview of the Nx S3 Cache Plugin
description: The @nx/s3-cache plugin enables you to use an Amazon S3 bucket to host your remote cache for efficient build caching across your team.
---

# @nx/s3-cache

The `@nx/s3-cache` plugin enables you to self-host your remote cache on an [Amazon S3](https://aws.amazon.com/s3) bucket.

{% callout type="warning" title="Bucket-based caches are vulnerable to poisoning and often prohibited in organizations" %}

CREEP (CVE-2025-36852) is a critical vulnerability in bucket-based self-hosted remote caches that allows anyone with PR access to poison production builds. Many organizations are unaware of this security risk. [Learn more](/blog/creep-vulnerability-build-cache-security)

`@nx/s3-cache` (along with other bucket-based remote cache implementations) is listed in the CVE, and is not allowed in many organizations.

{% /callout %}

{% callout type="deepdive" title="Nx Cloud: Managed Multi-Tier Remote Cache [Secure]" %}

Recommended for everyone.

- [Fully managed multi-tier remote caching with Nx Replay](/ci/features/remote-cache)
- [Both secure and fast](/enterprise/security)
- Generous free plan

You'll also get access to advanced CI features:

- [Automated distribution of tasks across machines with Nx Agents](/ci/features/distribute-task-execution)
- [Automated splitting of tasks (including e2e tests) with Nx Atomizer](/ci/features/split-e2e-tasks)
- [Detection and re-running of flaky tasks](/ci/features/flaky-tasks)
- [Self-healing CI and other AI features](/ai)

[Get Started](https://cloud.nx.app)
{% /callout %}

{% callout type="deepdive" title="Nx Enterprise [Secure]" %}

Recommended for large organizations.

Includes everything from Nx Cloud, plus:

- Work hand-in-hand with the Nx team for continual improvement
- Run on the Nx Cloud servers in any region or run fully self-contained, on-prem
- SOC 2 type 1 and 2 compliant and comes with single-tenant, dedicated EU region hosting as well as on-premise

[Reach out for an Enterprise trial](/enterprise/trial)

{% /callout %}

## Set Up @nx/s3-cache

### 1. Install the Package

Run the following command:

```shell
nx add @nx/s3-cache
```

This will add the `@nx/s3-cache` NPM package and automatically configure it for your workspace. As part of this process you'll be guided to **generate a new activation key**. This is a fully automated process to register your plugin.

The key will be saved in your repository (`.nx/key/key.ini`) and should be committed so that every developer has access to it. If your repository is public (or in CI) you can also use an environment variable:

```{% fileName=".env" %}
NX_KEY=YOUR_ACTIVATION_KEY
```

If you didn't get an activation key or skipped that step, you can easily generate one at any time by running `nx register` in your terminal.

> Why require an activation key? It simply helps us know and support our users. If you prefer not to provide this information, you can also build your own cache server. [Learn more.](/recipes/running-tasks/self-hosted-caching)

### 2. Authenticate with AWS

There are four different ways to authenticate with AWS. They will be attempted in this order:

1. Environment variables
2. INI config files
3. Single sign-on
4. `nx.json` settings

#### Environment Variables

[AWS provides environment variables](https://docs.aws.amazon.com/sdkref/latest/guide/environment-variables.html) that can be used to authenticate:

| **Environment Variable**    | **Description**                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`         | The access key for your AWS account.                                                                                                                                                                                                                                       |
| `AWS_SECRET_ACCESS_KEY`     | The secret key for your AWS account.                                                                                                                                                                                                                                       |
| `AWS_SESSION_TOKEN`         | The session key for your AWS account. This is only needed when you are using temporary credentials.                                                                                                                                                                        |
| `AWS_CREDENTIAL_EXPIRATION` | The expiration time of the credentials contained in the environment variables described above. This value must be in a format compatible with the [ISO-8601 standard](https://en.wikipedia.org/wiki/ISO_8601) and is only needed when you are using temporary credentials. |

Both the `AWS_ACCESS_KEY_ID` and the `AWS_SECRET_ACCESS_KEY` environment variables are required to use the environment variable authentication method.

Here's an example of using OIDC in GitHub Actions to set the environment variables in CI:

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

      - name: 'Configure AWS Credentials'
        uses: aws-actions/configure-aws-credentials@v4.0.2
        with:
          role-to-assume: arn:aws:iam::123456789123:role/GhAIBucketUserRole
          aws-region: us-east-1

        ...

      - run: pnpm exec nx affected -t lint test build
```

#### INI Config Files

AWS can read your authentication credentials from [shared INI config files](https://docs.aws.amazon.com/sdkref/latest/guide/file-format.html). The files are located at `~/.aws/credentials` and `~/.aws/config`. Both files are expected to be INI formatted with section names corresponding to profiles. Sections in the credentials file are treated as profile names, whereas profile sections in the config file must have the format of `[profile profile-name]`, except for the default profile. Profiles that appear in both files will not be merged, and the version that appears in the credentials file will be given precedence over the profile found in the config file.

#### Single Sign-On

Nx can read the active access token [created after running `aws sso login`](https://docs.aws.amazon.com/sdkref/latest/guide/understanding-sso.html) then request temporary AWS credentials. You can create the `AwsCredentialIdentityProvider` functions using the inline SSO parameters (`ssoStartUrl`, `ssoAccountId`, `ssoRegion`, `ssoRoleName`) or load them from [AWS SDKs and Tools shared configuration and credentials files](https://docs.aws.amazon.com/credref/latest/refdocs/creds-config-files.html). Profiles in the `credentials` file are given precedence over profiles in the `config` file.

#### Credentials in `nx.json` File

Storing your credentials in the `nx.json` file is the least secure of the 4 authentication options, since anyone with read access to your codebase will have access to your AWS credentials.

```jsonc {% fileName="nx.json" %}
{
  "s3": {
    "ssoProfile": "default",
    "accessKeyId": "MYACCESSKEYID",
    "secretAccessKey": "MYSECRETACCESSKEY"
  }
}
```

| **Property**        | **Description**                                                               |
| ------------------- | ----------------------------------------------------------------------------- |
| **ssoProfile**      | The name of the profile to use from your AWS CLI SSO Configuration (optional) |
| **endpoint**        | The AWS endpoint URL (optional)                                               |
| **accessKeyId**     | AWS Access Key ID (optional)                                                  |
| **secretAccessKey** | AWS secret access key (optional)                                              |

### 3. Configure S3 Cache

Regardless of how you manage your AWS authentication, you need to configure your Nx cache in the `nx.json` file. The `bucket` that you specify needs to already exist - Nx doesn't create it for you.

```jsonc {% fileName="nx.json" %}
{
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "encryptionKey": "create-your-own-key"
  }
}
```

| **Property**      | **Description**                                                                   |
| ----------------- | --------------------------------------------------------------------------------- |
| **region**        | The ID of the AWS region to use                                                   |
| **bucket**        | The name of the S3 bucket to use                                                  |
| **encryptionKey** | Nx encryption key used to encrypt and decrypt artifacts from the cache (optional) |

#### S3 Compatible Providers

To use `@nx/s3-cache` with S3 compatible providers ([MinIO](https://min.io/product/s3-compatibility), [LocalStack](https://www.localstack.cloud), [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces), [Cloudflare](https://www.cloudflare.com/developer-platform/solutions/s3-compatible-object-storage), etc.), `endpoint` will need to be provided. Some providers also need to have `forcePathStyle` set to true in the configuration.

Below is an example on how to connect to MinIO:

```jsonc {% fileName="nx.json" %}
{
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "endpoint": "https://play.min.io",
    "forcePathStyle": true,
    "accessKeyId": "abc1234",
    "secretAccessKey": "4321cba",
    "disableChecksum": true
  }
}
```

{% callout type="note" title="Minio and checksum validation" %}
If you are using MinIO earlier than `2024-07-04T14-25-45Z` it is recommended to enabled `disabledChecksum` else you may trigger aws-sdk checksum errors such as `x-amz-checksum-crc32`.
{% /callout %}

| **Property**        | **Description**                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **region**          | The ID of the S3 compatible storage region to use                                                         |
| **bucket**          | The name of the S3 compatible storage bucket to use                                                       |
| **forcePathStyle**  | Changes the way artifacts are uploaded. Usually used for S3 compatible providers (MinIO, LocalStack, etc) |
| **endpoint**        | The custom endpoint to upload artifacts to. If endpoint is not defined, the default AWS endpoint is used  |
| **accessKeyId**     | AWS Access Key ID (optional if `AWS_ACCESS_KEY_ID` is set in the environment)                             |
| **secretAccessKey** | AWS secret access key (optional if `AWS_SECRET_ACCESS_KEY` is set in the environment)                     |
| **disableChecksum** | This disables AWS' checksum validation for cache entries                                                  |

# Cache Modes

By default, Nx will try to write and read from the remote cache while running locally. This means that permissions must be set for users who are expected to access the remote cache.

Nx will only show warnings when the remote cache is not writable. You can disable these warnings by setting `localMode` to `read-only` or `no-cache` in the `nx.json` file.

```jsonc {% fileName="nx.json" %}
{
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "localMode": "read-only"
  }
}
```

The cache mode in CI can also be configured by setting `ciMode` to `read-only` or `no-cache` in the `nx.json` file. Or by setting `NX_POWERPACK_CACHE_MODE` to `read-only` or `no-cache` in the CI environment.

```jsonc {% fileName="nx.json" %}
{
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "ciMode": "read-only"
  }
}
```

### Migrating from Custom Tasks Runners

Many people who are interested in Nx Powerpack have previously used custom task runners. Nx offers a new and simpler extension API designed to meet the same use cases as the now-deprecated custom task runners.

To learn more about migrating from custom task runners, [please refer to this detailed guide](/deprecated/custom-tasks-runner).
