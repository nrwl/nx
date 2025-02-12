# GitHub Auth

First, you'll need to create a GitHub OAuth app for your organisation.

## Creating a GitHub OAuth app

From GitHub, click on your profile picture and chose "Settings":

![Step 1](/nx-cloud/enterprise/single-tenant/images/github_auth_step_1.png)

Then "Developer settings" from the left-hand menu:

![Step 2](/nx-cloud/enterprise/single-tenant/images/github_auth_step_2.png)

Then "OAuth Apps":

![Step 3](/nx-cloud/enterprise/single-tenant/images/github_auth_step_3.png)

And create a new OAuth app:

![Step 4](/nx-cloud/enterprise/single-tenant/images/github_auth_step_4.png)

Give it a name, and a homepage URL. The authorization callback is the important bit. It needs to be in this form:

```
[your-nx-cloud-url]/auth-callback

# for example
https://my.nx-enterprise.url:8080/auth-callback
```

![Step 5](/nx-cloud/enterprise/single-tenant/images/github_auth_step_5.png)

Once you create, keep a note of the Client ID:

![Step 6](/nx-cloud/enterprise/single-tenant/images/github_auth_step_6.png)

And then generate a new client secret, and save it somewhere secure (we'll use it in a bit):

![Step 7](/nx-cloud/enterprise/single-tenant/images/github_auth_step_7.png)

## Configure Nx Cloud Installation

Contact your developer productivity engineer to connect your Nx Cloud instance to the newly created GitHub OAuth app.
