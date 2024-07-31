# Nx CLI and CI Access Tokens

The permissions and membership define what developers can access on nx.app but they don't affect what happens when you run Nx commands in CI. To manage that, you need to provision CI access tokens in Workspace settings / Manage CI access tokens.

## Access Types

{% callout type="warning" title="Use Caution With Read-Write Tokens" %}
Read-write tokens allow full write access to your remote cache. They should only be used in trusted environments.
{% /callout %}

There are currently two (2) types of CI Access Token for Nx Cloud's runner that you can use with your workspace. Both support distributed task execution and allow Nx Cloud to store metadata about runs.

- `read-only`
- `read-write`

### Read Only Access

The `read-only` access tokens will only read from the remote cache. Task results will not be stored in the remote cache for other machines or CI pipelines to use.

### Read & Write Access

The `read-write` access tokens allows task results to be stored in the remote cache for other other machines or CI pipelines to download and replay.

## Setting CI Access Tokens

You can configure an access token in CI by setting the `NX_CLOUD_ACCESS_TOKEN` environment variable. `NX_CLOUD_ACCESS_TOKEN` takes precedence over any value in your `nx.json`.

We do not recommend that you commit an access token to your repository but older versions of Nx do support this and if you open your `nx.json`, you may see something like this:

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
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "accessToken": "SOMETOKEN"
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

{% callout type="warning" title="Nx Cloud authentication is changing" %}
From Nx 19.6 new workspaces are connected to Nx Cloud with a property called `nxCloudId` instead, and we recommend developers use [`nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login) to provision their own local [personal access tokens](/ci/recipes/security/personal-access-tokens).
{% /callout %}

## Using `nx-cloud.env`

You can set an environment variable locally via the `nx-cloud.env` file. Nx Cloud CLI will look in this file to load custom configuration like `NX_CLOUD_ACCESS_TOKEN`. These environment variables will take precedence over the configuration in `nx.json`.
