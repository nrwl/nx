# GitHub PR Integration

## Set Up a Webhook

- [Add a webhook to your repo](https://docs.github.com/en/developers/webhooks-and-events/creating-webhooks#setting-up-a-webhook)
- Payload URL is: `https://<NX_CLOUD_APP_URL>/nx-cloud/github-webhook-handler`
- Content type: `application/json`
- Add a "Secret" (can be anything). Remember it, as we'll need to pass it to our Docker container.

![Add webhook to github](/nx-cloud/private/images/private-cloud-github-integration-add-webhook.png)

- Enable "Check Suites", "Check runs" and "Pull Requests" as the events that trigger the webhook.

![Enable check suites and check runs](/nx-cloud/private/images/webhook-trigger-events.png)
![Enable pull requests](/nx-cloud/private/images/webhook-trigger-pull-requests.png)

## Generate Access token

- Your installation of Nx Cloud will need permission to post comments on your Pull Requests
- [Follow these instructions](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)
- Make sure you select "repo" as a scope
- After you generate the token, make sure to copy and store it. We'll add it to your installation of Nx Cloud in a bit.

![Generate personal access token](/nx-cloud/private/images/private-cloud-github-integration-generate-token.png)

## Optional - Configure Self-Hosted GitHub Instances

- If you are running a self-hosted edition of GitHub, you'll need to tell your installation of Nx Cloud where to make requests to
- Your GitHub API URL should look like this: `https://custom-github-host.com` (without a trailing slash)
- Keep a note of it, as we'll use it to configure your installation of Nx Cloud ☝️
- Optionally, you can try the above URL in the browser to see if it finds the API.
- Note if you use public GitHub, this step is not required. You also don't need to provision the `GITHUB_API_URL` env
  variable when creating a container.

## Configure Nx Cloud Installation

### Using Helm:

```yaml
image:
  tag: 'latest'

nxCloudAppURL: 'https://nx-cloud.myorg.com'

github:
  pr:
    enabled: true
    # apiUrl: '' uncomment when using github enterprise

secret:
  name: 'cloudsecret'
  nxCloudMongoServerEndpoint: 'NX_CLOUD_MONGO_SERVER_ENDPOINT'
  githubWebhookSecret: 'GITHUB_WEBHOOK_SECRET'
  githubAuthToken: 'GITHUB_AUTH_TOKEN'
```

Note that the secret must contain `GITHUB_WEBHOOK_SECRET` and `GITHUB_AUTH_TOKEN` (
see [Nx Cloud Helm Charts](https://github.com/nrwl/nx-cloud-helm) for more context).

### Not using Helm:

Provide the following env variables to the `nx-cloud-nx-api` container:

- `GITHUB_WEBHOOK_SECRET` set to the secret you provisioned
- `GITHUB_AUTH_TOKEN` set to the token generated for you
- `GITHUB_API_URL` set to the URL of your github installation

> If you are running Nx Cloud as a single container, the three env vars should be provisioned for that container.

## Optional - Configure `NX_CLOUD_INTEGRATION_DEFAULT_WORKSPACE_ID`

Nx Cloud uses the `accessToken` property from nx.json to find a workspace for a given GitHub repository. If it isn't
possible to set `accessToken`, you can also pass `NX_CLOUD_INTEGRATION_DEFAULT_WORKSPACE_ID` env variable to the
container. This value will be used when the `accessToken` property is missing. You can find the id of your workspace in
the URL.
