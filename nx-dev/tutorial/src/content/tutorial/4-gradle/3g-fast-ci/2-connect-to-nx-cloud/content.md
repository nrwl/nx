---
type: lesson
title: Connect to Nx Cloud
---

## Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

Now that we're working on the CI pipeline, it is important for your changes to be pushed to a GitHub repository.

1. Create a [new GitHub repository](https://github.com/new) if you don't already have one.
2. Copy the path to your repository (i.e. https://github.com/[your-user-name]/[your-repo-name].git)
3. In the terminal, add the GitHub repository as a remote with `git remote add origin https://github.com/[your-user-name]/[your-repo-name].git`
4. Commit your existing changes with `git add . && git commit -am "updates"`
5. Push your changes to your forked GitHub repository with `git push -u origin HEAD`

Now connect your repository to Nx Cloud with the following command:

```shell no-run
npx nx connect
```

A browser window will open to register your repository in your [Nx Cloud](https://cloud.nx.app) account. The link is also printed to the terminal if the windows does not open, or you closed it before finishing the steps. The app will guide you to create a PR to enable Nx Cloud on your repository.

![](/tutorials/images/nx-cloud-github-connect.avif)

Once the PR is created, merge it into your main branch.

![](/tutorials/images/github-cloud-pr-merged.avif)

And make sure you pull the latest changes locally:

```shell no-run
git pull
```

You should now have an `nxCloudId` property specified in the `nx.json` file.
