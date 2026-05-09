---
title: 'Enable Remote Caching for your Developer Machine with Nx Login'
videoUrl: 'https://youtu.be/vX-wgI1zlao'
duration: '1:38'
---

Do you want to allow your developers working on the Tasker monorepo

- to benefit from remote cache results (read-only access)
- to also contribute to the remote cache (read/write access)

It really depends on your use case. Nx Cloud uses Personal Access Tokens (PAT) to give you a fine-grained control mechanism how local workspaces should access the remote cache.

In this lesson, we'll dive into how to configure your Personal Access Token permissions on Nx Cloud and how developers can authenticate with the Nx Cloud workspace using:

```shell
pnpm nx login
```

## Relevant Links

- [Nx Cloud and Personal Access Tokens](/docs/guides/nx-cloud/personal-access-tokens)
- [Blog: Better security with Personal Access Tokens](/blog/personal-access-tokens)
