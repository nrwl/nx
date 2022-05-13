# Nx Private Cloud Auth

There are a few methods of authenticating users in Nx Private Cloud:

- single-admin user
- [GitHub OAuth2](https://nx.app/docs/private-cloud-github-auth)
- [GitLab OAuth2](https://nx.app/docs/private-cloud-gitlab-auth)

## Why do users need access

While just adding an NxCloud access token to your monorepo give you distributed caching, the NxCloud web app gives you analytics about tasks running in your workspace, allows devs to easily inspect terminal output, and works seamlessly with our GitHub integration for your Pull Requests. Here is a [video walkthrough of this](https://youtu.be/GT7XIwG1i5A?t=409).

By default, when you connect your token to a workspace on your NxCloud web app, all links and runs are private to only members of your organisation. This means that you'll either need to explicitly add members, or make your organisation public (which means anyone with access to your Private NxCloud instance will be able to see your runs). [More details here.](https://nx.app/docs/manage-access#accessing-nx-cloud)

## Setting up a single admin user

If you just want to try out private cloud and set-up full membership management later, then the simplest option is to just set-up a single admin user. This option might also work for you if you are okay with [making your organisation public](https://nx.app/docs/manage-access#accessing-nx-cloud) to anyone that has access to your private cloud NxCloud instance.

[While setting up your container](https://nx.app/docs/get-started-with-private-cloud-community) you can pass it the `ADMIN_PASSWORD` environment variable. This will set-up a default admin user for you, which you can use to manage your workspace on the NxCloud web app.

Note: Even if you can make your organisation public, we still recommend setting up GitHub authentication and inviting more than 1 admin to your workspace, to reduce the chance of losing access to it.

## Setting up third-party auth providers

For instructions on how to set-up third-party auth providers please refer to these guides:

- [GitHub Auth](https://nx.app/docs/private-cloud-github-auth)
- [GitLab Auth](https://nx.app/docs/private-cloud-gitlab-auth)

## Inviting users

Once that's done, you can either login with your admin user (see instructions below on how to log-in with admin), or directly via GitHub by hitting the "Log In" button:

![Main user login](/nx-cloud/private/images/main_user_login.png)

You can then go to your organisation's members page and start inviting people based on their GitHub username:

![Invite members](/nx-cloud/private/images/invite_members.png)

When you invite someone, NxCloud will generate a unique invite URL, which you can send to that person directly.

## Migrating from an admin-only set-up to auth via a configured provider

If you already have an admin user that manages an existing NxCloud workspace, you can still login, even after you set-up GitHub auth. You'll find the admin log-in button here:

![Admin hidden login](/nx-cloud/private/images/admin_hidden_login.png)

## Finding usernames

To ensure only the members you trust can accept invitations to your workspace, you need to invite them via their GitHub/GitLab/BitBucket username, and then they need to be logged in with that username to accept the invite. Usernames can usually be found by clicking in the top-right corner.

GitLab:

![GitLab username location](/nx-cloud/private/images/gitlab-username.png)

GitHub:

![GitHub username location](/nx-cloud/private/images/github-username.png)
