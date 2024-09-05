---
title: Better security with Personal Access Tokens
slug: personal-access-tokens
authors: ['Philip Fulcher']
tags: [nx-cloud]
cover_image: /blog/images/2024-09-05/personal-access-tokens-header.avif
---

Today, Nx Cloud gets a huge upgrade to managing access to your cached artifacts
using [Nx Replay](/ci/features/remote-cache). Previously, workspaces
were limited to defining access tokens with read or read/write permissions for an entire workspace. With the
introduction of _personal access tokens_, you gain much more control over access. This is a feature request we've heard
from many customers, especially our [Enterprise](/enterprise) customers, and we're happy to be able to deliver this
enhancement.

## Access Tokens and the problem of revoking access

Our previous implementation of access tokens required you to commit the access token to your `nx.json` file. Typically,
service providers don't recommend committing any kind of API token like this, and we've fielded a lot of questions about
this practice in the past. It is safe to commit this token, as access to the cached artifacts of Nx Cloud rely on both
the access token and the source code itself. Without access to both, you can't access the cache.

However, this did present the following problem: revoking someone's access to the cache became difficult as long as they
had the source code. Imagine a scenario where someone has left an organization. As long as they have a clone of the
repo, they have everything they need to access the cache, even if their credentials have been
revoked. To fully revoke
their access would require cycling the access token, which could interrupt the work of other developers and CI
pipelines.

## Access Tokens become CI Access Tokens

What we previously called "access tokens" will now be called "[CI access tokens](/ci/recipes/security/access-tokens)."
They are still defined at the workspace
level, but are designed for use in CI. These tokens should be set as environment variables or secrets on your CI
platform so that they're no longer committed to your repo.

## What are personal access tokens?

[Personal access tokens](/ci/recipes/security/personal-access-tokens) are a new type of access token that is scoped to
an individual user. This means that this token lives and dies with that member's access to your Nx Cloud workspace.
Users must log in to Nx Cloud and they are a member of a workspace before a personal access token can be created.
Once created, we validate that token for access each time you use the distributed cache. As soon as a user loses access,
the personal access token no
longer works, and access to the cache is removed.

This gets even more powerful when combined with the GitHub VCS integration. When a user's GitHub access is removed from
a GitHub-connected organization, their access to Nx Cloud is removed, and their personal access token is invalidated.
This means that Nx Cloud can fit into existing user de-provisioning processes you already have.

Open source teams also benefit from personal access tokens. You can configure your access to allow anonymous users to
read from the cache, but limit read/write access to core contributors.

## Controlling default access

![Personal access token settings in Nx Cloud workspace](/blog/images/2024-09-05/workspace-settings.avif)

By default, a workspace that opts in to personal access tokens will allow anonymous users (users without a personal
access token defined) read-only access. This can be changed to disallow access to the cache for anonymous users
in your workspace settings.

Users with personal access tokens will have read-only access to the cache. This can be changed to enable read-write
access in the workspace settings.

## Converting existing workspaces to use personal access tokens

Personal access tokens can be enabled with _Nx versions 13+_. These steps will get you started, but you
can [find more details in our docs](/ci/recipes/security/personal-access-tokens).

1. **Convert to using `nxCloudId` by running `npx nx-cloud convert-to-nx-cloud-id`** - Previously, your `nx.json` had a
   CI
   access token defined in the `nxCloudAccessToken` property. This command will replace that with `nxCloudId`, a generic
   id that references your workspace but no longer provides access to the cache.
2. **Generate a personal access token by running `npx nx-cloud login`** - Follow the directions in your terminal to log
   in
   to Nx Cloud. Each contributor with access to the workspace will need to complete this step.
3. **Move CI access tokens to environment variables** - Now that the access token is no longer committed to your
   `nx.json`,
   you'll need to provide that CI access token via the
   `NX_CLOUD_ACCESS_TOKEN` [environment variable](/ci/reference/env-vars#nxcloudaccesstoken).
4. **_Optional_ Disable anonymous access** - By default, anyone without a personal access token will have read-only
   access
   to your cached artifacts. Once everyone has a personal access token defined, you can disable this anonymous access in
   your Nx Cloud workspace settings.

[Learn more about using personal access tokens](/ci/recipes/security/personal-access-tokens)

## Learn more

- [Nx Docs](/getting-started/intro)
- [Nx Cloud Cache Security](/ci/concepts/cache-security)
- [Nx Cloud Personal Access Tokens](/ci/recipes/security/personal-access-tokens)
- [Nx Cloud CI Access Tokens](/ci/recipes/security/access-tokens)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](https://nx.app/)
