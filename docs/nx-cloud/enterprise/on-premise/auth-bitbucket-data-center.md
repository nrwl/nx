# BitBucket Data Center Auth

This page is for configuring auth via BitBucket Data Center (on-prem). If you are using BitBucket Cloud please refer to the docs [here](/ci/recipes/enterprise/on-premise/auth-bitbucket).

Before creating your container, your Bitbucket Data Center admin will need to create an "Application Link".

## Creating an Application Link

Your BitBucket installation admin will need to navigate to their installation settings:

![Step 1](/nx-cloud/enterprise/on-premise/images/bitbucket_onprem_1.png)

Then "Application Links":

![Step 2](/nx-cloud/enterprise/on-premise/images/bitbucket_onprem_2.png)

And create a new link using the settings below (make sure the callback URL is pointed to your BitBucket installation):

![Step 3](/nx-cloud/enterprise/on-premise/images/bitbucket_onprem_3.png)

## Connect your Nx Cloud installation to your new app

It's now time to enable auth on NxCloud. Refer to the [auth guide](https://github.com/nrwl/nx-cloud-helm/blob/main/AUTH-GUIDE.md) here for instructions on configuring your Helm values file.
