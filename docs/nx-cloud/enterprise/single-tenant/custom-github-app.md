# Custom GitHub App

Before creating your container, you'll need to create a GitHub app for your organisation.

## Creating a GitHub app

From GitHub, click on your profile picture and chose "Settings":

![Step 1](/nx-cloud/enterprise/single-tenant/images/github_auth_step_1.png)

Then "Developer settings" from the left-hand menu:

![Step 2](/nx-cloud/enterprise/single-tenant/images/github_auth_step_2.png)

Then "GitHub Apps":

![Step 3](/nx-cloud/enterprise/single-tenant/images/github_custom_app_step_3.avif)

And create a new GitHub app:

![Step 4](/nx-cloud/enterprise/single-tenant/images/github_custom_app_step_5.avif)

Give it a name, and a homepage URL. The callback URL is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/callbacks/github-user

# for example
https://my.nx-enterprise.url:8080/callbacks/github-user
```

Configure a webhook and give it a secret:
(the URL needs to match `https://<your-NxCloud-instance-URL>/nx-cloud/github-webhook-handler`)

![Step 5](/nx-cloud/enterprise/single-tenant/images/webhook.png)

Make sure you subscribe to the "Organization" events:

![Step 5.1](/nx-cloud/enterprise/single-tenant/images/webhook_events.png)

Once you create the app, keep a note of the Client ID and App ID:

![Step 6](/nx-cloud/enterprise/single-tenant/images/github_custom_app_step_6.avif)

Then generate a new client secret, and save it somewhere secure (we'll use it in a bit):

![Step 7](/nx-cloud/enterprise/single-tenant/images/github_auth_step_7.png)

Finally, scroll down and download a private key:

![Step 7](/nx-cloud/enterprise/single-tenant/images/private-key.png)

Then navigate to your download location locally and stringify the contents of the private key:

```bash
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' your-key.pem # keep a note of the output
```

Save the output of the above, as we'll also use it in a bit.

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

## Connect Your Nx Cloud Installation

Provide the following values to your developer productivity engineer so they can help connect Nx Cloud to your custom GitHub app:

- Github App Client ID
- Github App Client Secret
- Github App App ID
- Github App Private Key
- GitHub App Webhook Secret
