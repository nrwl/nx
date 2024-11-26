# Nx CLI and CI Access Tokens

The permissions and membership define what developers can access on nx.app but they don't affect what happens when you run Nx commands in CI. To manage that, you need to provision CI access tokens in your workspace settings, under the `Access Control` tab.

![Access Control Settings Page](/nx-cloud/recipes/access-control-settings.avif)

## Access Types

{% callout type="warning" title="Use Caution With Read-Write Tokens" %}
Read-write tokens allow full write access to your remote cache. They should only be used in trusted environments.
{% /callout %}

There are currently two (2) types of CI Access Token for Nx Cloud's runner that you can use with your workspace. Both support distributed task execution and allow Nx Cloud to store metadata about runs.

- `read-only`
- `read-write`

### Read Only Access

The `read-only` access tokens will only read from the remote cache. New task results will not be stored in the remote cache, but cached results can be downloaded and replayed for other machines or CI pipelines to use. This option provides the benefit of remote cache hits while restricting machines without proper permissions from adding entries into the remote cache.

### Read & Write Access

The `read-write` access tokens allows task results to be stored in the remote cache for other other machines or CI pipelines to download and replay.

## Setting CI Access Tokens

You can configure an access token in CI by setting the `NX_CLOUD_ACCESS_TOKEN` environment variable. `NX_CLOUD_ACCESS_TOKEN` takes precedence over any authentication method in your `nx.json`.

The following example shows how to set the `NX_CLOUD_ACCESS_TOKEN` environment variable in a GitHub Actions workflow. You will need to add the `secrets.NX_CLOUD_ACCESS_TOKEN` secret to your repository based on instructions provided by your CI provider (see [GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions) or [GitLab](https://docs.gitlab.com/ee/ci/variables/#define-a-cicd-variable-in-the-ui) instructions).

```yml {% fileName=".github/workflows/ci.yml" highlightLines=["29-32"] %}
name: CI
# ...
env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

jobs:
  main:
    runs-on: ubuntu-latest
    steps: ...
```

### Legacy methods of setting CI Access Tokens

#### Using CI Access Tokens in nx.json

We **do not recommend** that you commit an access token to your repository but older versions of Nx do support this and if you open your `nx.json`, you may see something like this:

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
From Nx 19.7 new workspaces are connected to Nx Cloud with a property called `nxCloudId` instead, and we recommend developers use [`nx login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login) to provision their own local [personal access tokens](/ci/recipes/security/personal-access-tokens) for user based authentication.
{% /callout %}

#### Using `nx-cloud.env`

You can set an environment variable locally via the `nx-cloud.env` file. Nx Cloud CLI will look in this file to load custom configuration like `NX_CLOUD_ACCESS_TOKEN`. These environment variables will take precedence over the configuration in `nx.json`.
