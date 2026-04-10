# Enable Bitbucket Integration

## Get Started

The Nx Cloud + Bitbucket Integration lets you access the result of every run—with all its logs and build insights—straight from your PR.

### Allow NxCloud to authenticate to your BitBucket repository

#### Using an App Password

If you are using BitBucket Cloud (bitbucket.org) and are not self-hosting it, you can enable an ["app password" for authentication](https://support.atlassian.com/bitbucket-cloud/docs/create-an-app-password).

The minimum required permissions are write access to PRs:

![Create App Password](/nx-cloud/set-up/minimal-bitbucket-cloud-app-password.webp)

Once the app password is created, save it in a secure location and then head back to your workspace settings on NxCloud and let's set up a BitBucket integration:

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.webp)

1. Fill-in all the required fields for selecting your Bitbucket repository
2. Username is found on the [account settings](https://bitbucket.org/account/settings/) screen (it is not your email address)
3. Paste your app password created earlier into the Access Token box
4. That's it!

#### Using an HTTP Access Tokens

If you are using BitBucket Data Center (on-prem) you need to enable ["HTTP Access Tokens" for authentication](https://confluence.atlassian.com/bitbucketserver/http-access-tokens-939515499.html).

{% callout type="note" title="User linked access tokens" %}
Due to the type of APIs NxCloud needs to call, we need to create an access [**at the user level**](https://confluence.atlassian.com/bitbucketserver/http-access-tokens-939515499.html). Repo level access tokens will not work.
{% /callout %}

The minimum required permissions are write access to the repository:

![Create an HTTP Access Token](/nx-cloud/set-up/bitbucket-data-center-access-token.png)

Once the token is created, save it in a secure location and then head back to your workspace settings on NxCloud and let's set up a BitBucket integration:

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.webp)

1. Fill-in all the required fields for selecting your Bitbucket repository
2. Username is found on the [account settings](https://your-bitbucket-instance.com/profile) screen (it is not your email address)
3. Paste your access token created earlier into the Access Token box
4. Make sure you give NxCloud the URL of your BitBucket instance (this can be in the simple form of `https://your-bitbucket-instance.com`)
5. That's it!
