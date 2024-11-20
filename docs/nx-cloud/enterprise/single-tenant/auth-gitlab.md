# GitLab Auth

Before creating your container, you'll need to create a GitLab app for your organisation.

## Creating a GitLab app

From GitLab, click on your profile picture and chose "Preferences":

![Step 1](/nx-cloud/enterprise/single-tenant/images/gitlab_step_1.png)

Then "Applications" from the left-hand menu:

![Step 2](/nx-cloud/enterprise/single-tenant/images/gitlab_step_2.png)

Give the app a name. The authorization callback is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/auth-callback

# for example
https://my.nx-enterprise.url:8080/auth-callback
```

**Important:** Ensure there is **no backslash at the end of the "Redirect URI"** (i.e. it matches the above pattern)

![Step 3](/nx-cloud/enterprise/single-tenant/images/gitlab_step_3.png)

Ensure you grant it the "`read_user`" scope:

![Step 4](/nx-cloud/enterprise/single-tenant/images/gitlab_step_4.png)

Click "Save application".

Once you create, keep a note of the Client ID and the Secret:

![Step 5](/nx-cloud/enterprise/single-tenant/images/gitlab_step_5.png)

## Connect Your Nx Cloud Installation to Your New App

Contact your developer productivity engineer to connect your Nx Cloud instance to the newly created GitLab app.
