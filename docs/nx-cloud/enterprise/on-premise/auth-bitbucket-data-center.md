# BitBucket Data CenterAuth

This page is for configuring auth via BitBucket Data Center (on-prem). If you are using BitBucket Cloud please refer to the docs [here](/ci/recipes/enterprise/on-premise/auth-bitbucket).

Before creating your container, your Bitbucket Data Center admin will need to create an "Application Link".

## Creating an Application Link

(TODO-R) finish this section with screenshots from bitbucket

From BitBucket, click on your profile picture and select your workspace:

![Step 1](/nx-cloud/enterprise/on-premise/images/bitbucket_1.png)

Then "Settings":

![Step 2](/nx-cloud/enterprise/on-premise/images/bitbucket_2.png)

And create a new consumer.

Give the app a name. The callback zURL is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/auth-callback

# for example
https://my.nx-enterprise.url:8080/auth-callback
```

## Connect your Nx Cloud installation to your new app

It's now time to enable auth on NxCloud. Refer to the [auth guide](https://github.com/nrwl/nx-cloud-helm/blob/main/AUTH-GUIDE.md) here for instructions on configuring your Helm values file.


