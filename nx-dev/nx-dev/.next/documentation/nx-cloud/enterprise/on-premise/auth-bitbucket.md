# BitBucket Cloud Auth

This page is only for BitBucket Cloud (bitbucket.org). If you have an on-premise version of BitBucket Data Center please refer to the docs [here](/ci/recipes/enterprise/on-premise/auth-bitbucket-data-center).

First, you'll need to create a BitBucket "OAuth consumer" for your organisation.

## Creating a BitBucket OAuth consumer

From BitBucket, click on your profile picture and select your workspace:

![Step 1](/nx-cloud/enterprise/on-premise/images/bitbucket_1.png)

Then "Settings":

![Step 2](/nx-cloud/enterprise/on-premise/images/bitbucket_2.png)

Then "OAuth consumers":

![Step 3](/nx-cloud/enterprise/on-premise/images/bitbucket_3.png)

And create a new consumer.

Give the app a name. The callback URL is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/auth-callback

# for example
https://my.nx-enterprise.url:8080/auth-callback
```

**Important:** Ensure there is **no backslash at the end of the "Callback URL"** (i.e. it matches the above pattern)

![Step 4](/nx-cloud/enterprise/on-premise/images/bitbucket_4.png)

Ensure you grant it the `account:read` and `account:email` scopes:

![Step 5](/nx-cloud/enterprise/on-premise/images/bitbucket_5.png)

Save your changes.

Once you create, keep a note of the Key and the Secret:

![Step 6](/nx-cloud/enterprise/on-premise/images/bitbucket_6.png)

## Connect your Nx Cloud installation to your new app

It's now time to enable auth on NxCloud. Refer to the [auth guide](https://github.com/nrwl/nx-cloud-helm/blob/main/AUTH-GUIDE.md) here for instructions on configuring your Helm values file.
