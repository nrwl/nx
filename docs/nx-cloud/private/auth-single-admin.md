# Auth (Basic)

## Why do users need access?

While just adding an Nx Cloud access token to your monorepo gives you distributed caching and distributed tasks
execution, the Nx Cloud web app gives you analytics about tasks running in your workspace, allows devs to easily inspect
terminal output, and works seamlessly with our GitHub integration for your Pull Requests. Here is
a [video walkthrough of this](https://youtu.be/GT7XIwG1i5A?t=409).

By default, when you connect your token to a workspace on your Nx Cloud web app, all links and runs are private to only
members of your organisation. This means that you'll either need to explicitly add members, or make your organisation
public (which means anyone with access to your Nx Cloud instance will be able to see your runs)
. [More details here.](/nx-cloud/account/users#managing-members)

## Setting up a single admin user

If you just want to try out running Nx Cloud on prem and set up full membership management later, then the simplest
option is to
just set up a single admin user. This option might also work for you if you are okay
with [making your organisation public](/nx-cloud/account/users#public-organizations) to anyone that has access to your
Nx Cloud installation.

To do that provision the `ADMIN_PASSWORD` env variable for the `nx-cloud-aggregator` container (if you are running Nx
Cloud as a single container, provision the `ADMIN_PASSWORD` env variable for that container). This will set up a
default admin user for you, which you can use to manage your workspace on the Nx Cloud web app.

{% callout type="note" title="Preventing access loss" %}
Even if you can make your organisation public, we still recommend setting up GitHub authentication and inviting more
than 1 admin to your workspace, to reduce the chance of losing access to it.
{% /callout %}

## Setting up third-party auth providers

For instructions on how to set up third-party auth providers, please refer to these guides:

- [GitHub Auth](/nx-cloud/private-cloud/auth-github)
- [GitLab Auth](/nx-cloud/private-cloud/auth-gitlab)
- [BitBucket Auth](/nx-cloud/private-cloud/auth-bitbucket)
- [SAML Auth](/nx-cloud/private-cloud/auth-saml)

## Inviting users

Once that's done, you can either sign in with your admin user by using the form, or
directly via the configured third-party authentication providers by clicking the "_Sign In with configured third-party provider_" button:

![Main user login](/nx-cloud/private/images/main-user-login.webp)

You can then go to your organisation's settings and then to the members page and start inviting people based on their GitHub username.
When you invite someone, Nx Cloud will generate a unique invite URL, which you can send to that person directly.

## Migrating from an admin-only set up to auth via a configured provider

If you already have an admin user that manages an existing Nx Cloud workspace, you can still login by using the login form, even after you set up
GitHub auth.

## Finding usernames

To ensure only the members you trust can accept invitations to your workspace, you need to invite them via their
GitHub/GitLab/BitBucket username, and then they need to be logged in with that username to accept the invite. Usernames
can usually be found by clicking in the top-right corner.

GitLab:

![GitLab username location](/nx-cloud/private/images/gitlab-username.png)

GitHub:

![GitHub username location](/nx-cloud/private/images/github-username.png)
