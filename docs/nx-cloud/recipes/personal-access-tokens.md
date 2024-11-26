# Nx Cloud and Personal Access Tokens

From Nx 19.7 repositories are connected to Nx Cloud via a property in `nx.json` called `nxCloudId`. By default this value allows anyone who clones the repository `read-write` access to Nx Cloud features for that workspace. These permissions can be updated in the workspace settings. To disallow access to anonymous users or allow `read-write` access to known users it is required that all users provision their own personal access token. To do that they need to use [`npx nx login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login).

{% callout type="warning" title="Personal Access Tokens require the `nxCloudId` field in `nx.json`" %}
Ensure that you have the `nxCloudId` property in your `nx.json` file to connect to Nx Cloud with a Personal Access Token. If you have been using `nxCloudAccessToken`, you can convert it to `nxCloudId` by running [`npx nx-cloud convert-to-nx-cloud-id`](/ci/reference/nx-cloud-cli#npx-nxcloud-converttonxcloudid).
{% /callout %}

{% tabs %}
{% tab label="Nx >= 19.7" %}

```json {% fileName="nx.json" %}
{
  "nxCloudId": "SOMEID"
}
```

{% /tab %}
{% tab label="Nx <= 19.6" %}

```json {% fileName="nx.json" %}"
"tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "nxCloudId": "SOMEID"
      }
    }
  }
```

To utilize personal access tokens and Nx Cloud ID with Nx <= 19.6, the nx-cloud npm package is also required to be installed in your workspaces `package.json`.

```json {% fileName="package.json" %}"
{
  "devDependencies": {
    "nx-cloud": "latest"
  }
}
```

{% /tab %}
{% /tabs %}

## Personal Access Tokens (PATs)

When you run [`npx nx login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login) you will be directed to the Nx Cloud app where you will be required to create an account and login. A new personal access token will be provisioned and saved in a local configuration file in your home folder (the location of this will be displayed when login is complete and varies depending on OS).

### View your Personal Access Tokens

You can view your personal access tokens in the Nx Cloud app by navigating to your profile settings. Click your user icon in the top right corner of the app and select `Profile`.

![Profile Settings](/nx-cloud/recipes/profile-page.avif)

From there, click on the `Personal access tokens` tab.

![Personal Access Tokens](/nx-cloud/recipes/personal-access-tokens-profile.avif)

### Manually create a Personal Access Token

Personal access tokens can also be manually created in the Nx Cloud app. Navigate to your profile settings and click on the `Personal access tokens` tab. Select `New access token`, enter a name for the token and click `Generate Token`. The token will be displayed on the screen and can be copied to your clipboard.

You can then use [nx-cloud configure](/ci/reference/nx-cloud-cli#npx-nxcloud-configure) in your terminal to set the token in your local configuration file.

## Permissions

There are two types of permissions that can be granted to users.

### Workspace ID access level

These are the permissions granted to users who are not [logged in](/ci/reference/nx-cloud-cli#npx-nxcloud-login) or are not members of the Nx Cloud organization for this workspace. By default, all users have `read-write` access to the workspace. This can be updated in the workspace settings to `read-only` or `none`.

While the initial setting for workspace ID access level is `read-write`, we recommend that you change this setting to `read-only` or `none` for any repository that is visible to people that do not have permission to edit the repository (i.e. open source repositories or repositories that are visible across an organization, but only editable by a specific team).

### Personal Access Token access level

When a workspace member logs in with a personal access token after running [`npx nx login`](/ci/reference/nx-cloud-cli#npx-nxcloud-login) they are granted access to Nx Cloud features.
By default all personal access tokens have `read-write` access to the remote cache. This can be updated to `read-only` in the workspace settings if required.

## Better Security

Without an access token committed to your `nx.json` file you gain more fine-grained control over who has access to your cache artifacts and who can utilise Nx Cloud features that you pay for. When you remove a member from your organization they will immediately lose access to all Nx Cloud features saving you the trouble of needing to cycle any tokens you were previously committing to the repository.
