# BitBucket Auth

Nx Private Cloud currently only support **public** BitBucket auth. On-prem installation of BitBucket Server are currently not supported.

Before creating your container, you'll need to create a BitBucket "OAuth consumer" for your organisation.

## Creating a BitBucket OAuth consumer

From BitBucket, click on your profile picture and select your workspace:

![Step 1](/nx-cloud/private/images/bitbucket_1.png)

Then "Settings":

![Step 2](/nx-cloud/private/images/bitbucket_2.png)

Then "OAuth consumers":

![Step 3](/nx-cloud/private/images/bitbucket_3.png)

And create a new consumer.

Give the app a name. The callback URL is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/auth/bitbucket/callback

# for example
https://my-private-cloud-url:8080/auth/bitbucket/callback
```

**Important:** Ensure there is **no backslash at the end of the "Callback URL"** (i.e. it matches the above pattern)

![Step 4](/nx-cloud/private/images/bitbucket_4.png)

Ensure you grant it the `account:read` and `account:email` scopes:

![Step 5](/nx-cloud/private/images/bitbucket_5.png)

Save your changes.

Once you create, keep a note of the Key and the Secret:

![Step 6](/nx-cloud/private/images/bitbucket_6.png)

## Connect your Nx Cloud installation to your new app

Provide the following env variables to the `nx-cloud-api` container:

- `BITBUCKET_APP_ID`
- `BITBUCKET_APP_SECRET`
