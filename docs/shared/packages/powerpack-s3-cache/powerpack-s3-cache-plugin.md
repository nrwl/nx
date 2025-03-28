---
title: Overview of the Nx powerpack-s3-cache Plugin
description: The powerpack-s3-cache Nx plugin enables you to use an Amazon S3 bucket to host your remote cache instead of Nx Cloud
---

The `@nx/powerpack-s3-cache` plugin enables you to use an [Amazon S3](https://aws.amazon.com/s3) bucket instead of Nx Cloud to host your remote cache.

This plugin will enable the remote cache for your Nx workspace, but does not provide any of the other features of Nx Cloud. If you want to leverage [distributed task execution](/ci/features/distribute-task-execution), [re-running flaky tasks](/ci/features/flaky-tasks) or [automatically splitting tasks](/ci/features/split-e2e-tasks), you'll need to [connect to Nx Cloud](/ci/intro/connect-to-nx-cloud) and use [Nx Replay](/ci/features/remote-cache) instead.

{% callout title="No Cache Poisoning" %}
`@nx/powerpack-s3-cache` implements content integrity checks to prevent cache poisoning, making it a more secure solution than previous DIY approaches.
{% /callout %}

{% callout title="This plugin requires an active Nx Powerpack license" %}
In order to use `@nx/powerpack-s3-cache`, you need to have an active Powerpack license. If you don't have a license or it has expired, your cache will no longer be shared and each machine will use its local cache.
{% /callout %}

## Set Up @nx/powerpack-s3-cache

### 1. Install the Package

1. [Activate Powerpack](/nx-enterprise/activate-powerpack) if you haven't already. It only takes a minute.
2. Install the package

```shell
nx add @nx/powerpack-s3-cache
```

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

Here's an example of using OICD in GitHub Actions to set the environment variables in CI:

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

Storing your credentials in the `nx.json` file is the least secure of the 4 authentication options, since anyone with read access to your code base will have access to your AWS credentials.

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
| **region**        | The id of the AWS region to use                                                   |
| **bucket**        | The name of the S3 bucket to use                                                  |
| **encryptionKey** | Nx encryption key used to encrypt and decrypt artifacts from the cache (optional) |

#### S3 Compatible Providers

To use `@nx/powerpack-s3-cache` with S3 compatible providers ([MinIO](https://min.io/product/s3-compatibility), [LocalStack](https://www.localstack.cloud), [DigitalOcean Spaces](https://www.digitalocean.com/products/spaces), [Cloudflare](https://www.cloudflare.com/developer-platform/solutions/s3-compatible-object-storage), etc..), `endpoint` will need to be provided. Some providers also need to have `forcePathStyle` set to true in the configuration.

Below is an example on how to connect to MinIO:

```jsonc {% fileName="nx.json" %}
{
  "s3": {
    "region": "us-east-1",
    "bucket": "my-bucket",
    "endpoint": "https://play.min.io",
    "forcePathStyle": true,
    "accessKeyId": "abc1234",
    "secretAccessKey": "4321cba"
  }
}
```

| **Property**        | **Description**                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| **region**          | The id of the S3 compatible storage region to use                                                         |
| **bucket**          | The name of the S3 compatible storage bucket to use                                                       |
| **forcePathStyle**  | Changes the way artifacts are uploaded. Usually used for S3 compatible providers (MinIO, LocalStack, etc) |
| **endpoint**        | The custom endpoint to upload artifacts to. If endpoint is not defined, the default AWS endpoint is used  |
| **accessKeyId**     | AWS Access Key ID (optional if `AWS_ACCESS_KEY_ID` is set in the environment)                             |
| **secretAccessKey** | AWS secret access key (optional if `AWS_SECRET_ACCESS_KEY` is set in the environment)                     |

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

The cache mode in CI can also be configured by setting `ciMode` to `read-only` or `no-cache` in the `nx.json` file. Or setting `NX_POWERPACK_CACHE_MODE` to `read-only` or `no-cache` in the CI environment.

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
