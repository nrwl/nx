# BitBucket Data Center Auth

This page is for configuring auth via BitBucket Data Center (on-prem). If you are using BitBucket Cloud please refer to the docs [here](/ci/recipes/enterprise/single-tenant/auth-bitbucket).

Before creating your container, your Bitbucket Data Center admin will need to create an "Application Link".

## Creating an Application Link

Your BitBucket installation admin will need to navigate to their installation settings:

![Step 1](/nx-cloud/enterprise/single-tenant/images/bitbucket_onprem_1.png)

Then "Application Links":

![Step 2](/nx-cloud/enterprise/single-tenant/images/bitbucket_onprem_2.png)

And create a new link using the settings below (make sure the callback URL is pointed to your BitBucket installation):

![Step 3](/nx-cloud/enterprise/single-tenant/images/bitbucket_onprem_3.png)

## Connect Your Nx Cloud Installation to Your New App

Contact your developer productivity engineer to connect your Nx Cloud instance to the newly created BitBucket data center app.
