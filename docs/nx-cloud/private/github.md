# Private Cloud GitHub Integration

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

- Private Cloud will need permission to post comments on your Pull Requests
- [Follow these instructions](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)
- Make sure you select "repo" as a scope
- After you generate the token, make sure to copy and store it. We'll add it to Private Cloud in a bit.

![Generate personal access token](/nx-cloud/private/images/private-cloud-github-integration-generate-token.png)

## Optional - Configure Self-Hosted GitHub Instances

- If you are running a self-hosted edition of GitHub, you'll need to tell Private Cloud where to make requests to
- Your GitHub API URL should look like this: `https://custom-github-host.com` (without a trailing slash)
- Keep a note of it, as we'll use it to configure Private Cloud ☝️
- Optionally, you can try the above URL in the browser to see if it finds the API.
- Note if you use public GitHub, this step is not required. You also don't need to provision the `GITHUB_API_URL` env variable when creating a container.

Run your container with all the configuration options we generated above:

```bash
> docker run --name cloud \
    -p 80:8081 \
    -e NX_CLOUD_MODE=private-community \
    -e NX_CLOUD_APP_URL="https://cloud.myorg.com" \
    -e ADMIN_PASSWORD=admin \
    -e GITHUB_WEBHOOK_SECRET=SECRET_YOU_PROVISIONED \
    -e GITHUB_AUTH_TOKEN=TOKEN_GENERATED_FOR_YOU \
    -e GITHUB_API_URL=URL \
    -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

## Optional - Configure `NX_CLOUD_INTEGRATION_DEFAULT_WORKSPACE_ID`

Nx Cloud uses the `accessToken` property from nx.json to find a workspace for a given GitHub repository. If it isn't possible to set `accessToken`, you can also pass `NX_CLOUD_INTEGRATION_DEFAULT_WORKSPACE_ID` env variable to the container. This value will be used when the `accessToken` property is missing. You can find the id of your workspace in the URL.
