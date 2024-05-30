# Custom GitHub App

Before creating your container, you'll need to create a GitHub app for your organisation.

## Creating a GitHub OAuth app

From GitHub, click on your profile picture and chose "Settings":

![Step 1](/nx-cloud/enterprise/on-premise/images/github_auth_step_1.png)

Then "Developer settings" from the left-hand menu:

![Step 2](/nx-cloud/enterprise/on-premise/images/github_auth_step_2.png)

Then "GitHub Apps":

![Step 3](/nx-cloud/enterprise/on-premise/images/github_custom_app_step_3.avif)

And create a new GitHub app:

![Step 4](/nx-cloud/enterprise/on-premise/images/github_custom_app_step_5.avif)

Give it a name, and a homepage URL. The callback URL is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/callbacks/github-user

# for example
https://my.nx-enterprise.url:8080/callbacks/github-user
```

Once you create the app, keep a note of the Client ID and App ID:

![Step 6](/nx-cloud/enterprise/on-premise/images/github_custom_app_step_6.avif)

Then generate a new client secret, and save it somewhere secure (we'll use it in a bit):

![Step 7](/nx-cloud/enterprise/on-premise/images/github_auth_step_7.png)

## Configure Permissions for the GitHub App

The following permissions are required for Nx Cloud to work:

Repository permissions:

- `Contents: Read & Write`
- `Pull requests: Read & Write`
- `Checks: Read Only`
- `Commit Statuses: Read & Write`
- `Issues: Read & Write`
- `Metadata: Read Only`

Organization permissions:

- `Administration: Read Only`
- `Members: Read Only`

## Configure Nx Cloud Installation

### Using Helm:

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

github:
  auth:
    enabled: true

secret:
  name: 'cloudsecret'
  githubAppClientId: 'NX_CLOUD_GITHUB_APP_CLIENT_ID'
  githubAppClientSecret: 'NX_CLOUD_GITHUB_APP_CLIENT_SECRET'
  githubAppId: 'NX_CLOUD_GITHUB_APP_APP_ID'
```

Note that the secret must contain `NX_CLOUD_GITHUB_APP_CLIENT_ID`, `NX_CLOUD_GITHUB_APP_APP_ID`, and `NX_CLOUD_GITHUB_APP_CLIENT_SECRET` (
see [Nx Cloud Helm Charts](https://github.com/nrwl/nx-cloud-helm) for more context).

### Not using Helm:

Provide the following env variables to the `nx-cloud-frontend` container:

- `NX_CLOUD_GITHUB_APP_CLIENT_ID`
- `NX_CLOUD_GITHUB_APP_CLIENT_SECRET`
- `NX_CLOUD_GITHUB_APP_APP_ID`

{% callout title="Helm Chart Environment Variables" %}
If you are using our Helm chart, you can find all the information you need about env variables in [the Helm chart repository](https://github.com/nrwl/nx-cloud-helm/blob/main/AUTH-GUIDE.md).
{% /callout %}

<!-- ## GitHub Enterprise

If you are running a self-hosted version of GitHub (Enterprise Server), you will need to configure one additional
environment variable:

`GITHUB_API_URL=https://custom-github-instance.com`

This will point all auth endpoints to your GitHub server (rather the public one).

{% callout type="check" title="Good to know!" %}
The above environment variable, also helps with setting up the GitHub app integration, so you can have Nx Cloud build
stats directly on your pull request. See full set up instructions [here](/ci/recipes/source-control-integration/github).
{% /callout %} -->
