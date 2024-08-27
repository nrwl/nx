# Nx Cloud and Personal Access Tokens

From Nx 19.6 repositories are connected to Nx Cloud via a property in `nx.json` called `nxCloudId`. By default this value allows anyone who clones the repository `read-only` access to Nx Cloud features for that workspace. These permissions can be updated in the workspace settings. To disallow access to anonymous users or allow `read-write` access to known users it is required that all users provision their own personal access token. To do that they need to use [`npx nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login).

{% callout type="warning" title="Personal Access Tokens require the `nxCloudId` field in `nx.json`" %}
Ensure that you have the `nxCloudId` property in your `nx.json` file to connect to Nx Cloud with a Personal Access Token. If you have been using `nxCloudAccessToken`, you can convert it to `nxCloudId` by running [`npx nx-cloud convert-to-nx-cloud-id`](/ci/reference/nx-cloud-cli#npx-nxcloud-converttonxcloudid).
{% /callout %}

{% tabs %}
{% tab label="Nx >= 19.7" %}

```json
{
  "nxCloudId": "SOMEID"
}
```

{% /tab %}
{% tab label="Nx < 19.6" %}

```json
"tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "nxCloudId": "SOMEID"
      }
    }
  }
```

{% /tab %}
{% /tabs %}

## Personal Access Tokens (PATs)

When you run [`npx nx-cloud login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login) you will be directed to the Nx Cloud app where you will be required to create an account and login. A new personal access token will be provisioned and saved in a local configuration file in your home folder (the location of this will be displayed when login is complete and varies depending on OS).

## Permissions

By default all personal access tokens have `read-only` local access to Nx Cloud features for the workspace in which that user is a member. This can be updated to `read-write` in the workspace settings if required, although it is typical for local access to be restricted to `read-only`.

## Better Security

Without an access token committed to your `nx.json` file you gain more fine-grained control over who has access to your cache artifacts and who can utilise Nx Cloud features that you pay for. When you remove a member from your organization they will immediately lose access to all Nx Cloud features saving you the trouble of needing to cycle any tokens you were previously committing to the repository.
