# Configuring the Cloud Runner / Nx CLI

The Nx Cloud runner is configured in `nx.json`.

{% tabs %}
{% tab label="Nx >= 17" %}

```json
{
  "nxCloudAccessToken": "SOMETOKEN"
}
```

{% /tab %}
{% tab label="Nx < 17" %}

```json
"tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "accessToken": "SOMETOKEN"
      }
    }
  }
```

{% /tab %}
{% /tabs %}

## Cacheable Operations

Targets can be marked as cacheable either in the `targetDefaults` in `nx.json` or in the project configuration by setting `"cache": true`. With this option enabled they can be cached and distributed using Nx Cloud.

## Timeouts

By default, Nx Cloud requests will time out after 10 seconds. `NX_CLOUD_NO_TIMEOUTS` disables the timeout.

```shell
NX_CLOUD_NO_TIMEOUTS=true nx run-many -t build
```

## Logging

Setting `NX_VERBOSE_LOGGING=true` when running a command will emit a large amount of metadata It will print information about what artifacts are being downloaded and uploaded, as well as information about the hashes of every computation.

This can be useful for debugging unexpected cache misses, and issues with on-prem setups.

`NX_VERBOSE_LOGGING=true` will also print detailed information about distributed task execution, such as what commands were sent where, etc.

`NX_VERBOSE_LOGGING` is often enabled in CI globally while debugging your CI setups.

## Access Tokens

`NX_CLOUD_AUTH_TOKEN` and `NX_CLOUD_ACCESS_TOKEN` are aliases of each other. This configuration allows you to override the access token set in `nx.json`. It is often enabled in CI to provide read-write privileges where only a read token is committed to the workspace's `nx.json`.

## Enabling End-to-End Encryption

All communication with Nx Cloud’s API and cache is completed over HTTPS, but you can optionally enable e2e encryption by providing a secret key through `nx.json` or the `NX_CLOUD_ENCRYPTION_KEY` environment variable.

{% tabs %}
{% tab label="Nx >= 17" %}
In `nx.json`, add the `nxCloudEncryptionKey` property. It will look something like this:

```json
{
  "nxCloudEncryptionKey": "cheddar"
}
```

{% /tab %}
{% tab label="Nx < 17" %}
In `nx.json`, locate the `taskRunnerOptions` property. Under its "options" property, you can add another property called `encryptionKey`. This is what will be used to encrypt your artifacts. It will look something like this:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "accessToken": "SOMETOKEN",
        // Add the following property with your secret key
        "encryptionKey": "cheddar"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

To instead use an environment variable to provide your secret key, run any Nx command as follows:

```shell
NX_CLOUD_ENCRYPTION_KEY=myEncryptionKey nx build my-project
```

This is an alternative to providing the encryption key through `nx.json`, but functionally it is identical.

## Loading Env Variables From a File

If you create an env file called `nx-cloud.env` at the root of the workspace, the Nx Cloud runner is going to load `NX_CLOUD_ENCRYPTION_KEY` and `NX_CLOUD_AUTH_TOKEN` from it. The file is often added to `.gitignore`.

## Disabling Connections to Nx Cloud

If your organization has a security reason to disable Nx Cloud, you can cause all methods of connection to fail by adding the `neverConnectToCloud` property to `nx.json`.

This does not disable the prompts themselves, as the `nx-cloud` package handles this property to provide maximum compatibility with Nx.

A side effect of this is that the `nx-cloud` or `@nrwl/nx-cloud` package may still be installed in your workspace. You can safely remove this, and its presence will send no data (telemetry or otherwise) to Nx Cloud.

You must be on version `16.0.4` or later of `nx-cloud` or `@nrwl/nx-cloud` for this value to be respected.

```json
{
  // The following will cause all attempts to connect your workspace to Nx Cloud to fail
  "neverConnectToCloud": true
}
```
