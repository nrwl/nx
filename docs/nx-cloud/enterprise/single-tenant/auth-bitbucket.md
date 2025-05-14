# BitBucket Cloud Auth

This page is only for BitBucket Cloud (bitbucket.org). If you have an on-premise version of BitBucket Data Center please refer to the docs [here](/ci/recipes/enterprise/single-tenant/auth-bitbucket-data-center).

First, you'll need to create a BitBucket "OAuth consumer" for your organisation.

## Creating a BitBucket OAuth Consumer

From BitBucket, click on your profile picture and select your workspace:

![Step 1](/nx-cloud/enterprise/single-tenant/images/bitbucket_1.png)

Then "Settings":

![Step 2](/nx-cloud/enterprise/single-tenant/images/bitbucket_2.png)

Then "OAuth consumers":

![Step 3](/nx-cloud/enterprise/single-tenant/images/bitbucket_3.png)

And create a new consumer.

Give the app a name. The callback URL is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/auth-callback

# for example
https://my.nx-enterprise.url:8080/auth-callback
```

**Important:** Ensure there is **no backslash at the end of the "Callback URL"** (i.e. it matches the above pattern)

![Step 4](/nx-cloud/enterprise/single-tenant/images/bitbucket_4.png)

Ensure you grant it the `account:read` and `account:email` scopes:

![Step 5](/nx-cloud/enterprise/single-tenant/images/bitbucket_5.png)

Save your changes.

Once you create, keep a note of the Key and the Secret:

![Step 6](/nx-cloud/enterprise/single-tenant/images/bitbucket_6.png)

## Connect Your Nx Cloud Installation to Your BitBucket OAuth Consumer

Contact your developer productivity engineer to connect your Nx Cloud instance to the newly created BitBucket OAuth consumer.
