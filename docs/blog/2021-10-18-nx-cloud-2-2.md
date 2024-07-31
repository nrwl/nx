---
title: '☁️ Nx Cloud 2.2 ☁️'
slug: 'nx-cloud-2-2'
authors: ['Jo Hanna Pearce']
cover_image: '/blog/images/2021-10-18/1*A3X910FexWnToKlnOf1X0A.png'
tags: [nx, release]
---

It’s been three months since we last updated you with what’s going on in the computation caching wonderworld that is Nx Cloud and in that time we’ve been hard at work bringing you fixes, improvements, and brand new features.

While we’ve worked on a variety of aspects, there have been two main areas of focus for us this quarter: **User Experience** and **Enterprise Readiness**.

## 💻 User Experience

This is something we will always be working at. We take into account both our own experience from using it internally and any feedback we get from our users. Making the Nx Cloud experience simple and intuitive is hugely important to us and to that end we’ve introduced quite a few fixes and tweaks which help make life with Nx Cloud even better. However, there are two big changes we’d like to highlight:

### 🚀 New Workspace Setup

If you have just connected your workspace to Nx Cloud there are a few things you can do next to explore the UI and we’ve just added something to help guide you around. You should see this new link on your workspace dashboard:

![](/blog/images/2021-10-18/1*sBXNN2IyQeQHRHJpoyrI6A.avif)

Click through to see our new mini-guides which detail the next steps to setup your workspace. Get started by running your first command and then being taken on a tour of the Run and Branch Details pages. We’ll save your progress as you continue to setup and show you how much is left to explore.

![](/blog/images/2021-10-18/1*COue7syEXpvdj4OxaRR0GA.avif)

With our other mini guides to illustrate how distributed caching can save you time, how to set up GitHub integration and how to configure the new Distributed Task Execution feature which allows you to let Nx Cloud orchestrate tasks across multiple CI agents, how soon will you reach 100%?

![](/blog/images/2021-10-18/1*eTpJ3GPl5Hm7-bU9JXI8aQ.avif)

### 🔍 Near Misses

One of the most confusing things about caching can be understanding cache misses. Why did we pull from the cache that time but not this one? What changed? This can be especially frustrating when you’re not expecting there to have been a change at all!

When we check Nx Cloud for a given task that is going to run, we use a variety of identifying data to determine a match such as source code, dependencies and runtime parameters. If any one of these is different we call it a cache miss and nothing is pulled from Nx Cloud — no time is saved! 😞

Understanding these cache misses is where the concept of a “near miss” can come in useful. A “near miss” is a task with the same target (e.g. `mylib:test`) but with very slightly different identifying data. Now when you drill into a task on our Run Details page you’ll see an option to check for these near misses:

![](/blog/images/2021-10-18/1*JCQG1hI73zLDT6bM9WIb7A.avif)

Clicking this will bring up a brand new dialog giving you more detail on what we found. We present you with up to three cached tasks that are closely related to the selected one and tell you in plain English why they’re different. You can click through from these to the relevent run or task to investigate further.

![](/blog/images/2021-10-18/1*MHF1aB5U2RbMPMtFSYUX0g.avif)

We hope this will give you some insight into why you’re not getting the cache hits you hoped for!

## 🏢 Enterprise Readiness

For those teams that need full control of their cached data we offer [Nx Private Cloud](https://nx.app/docs/get-started-with-private-cloud-enterprise) which can be installed on premises. We know that managing authentication is something every company has to handle, so to help plug Nx Private Cloud into your existing infrastructure we’ve brought you a new feature:

### 🐙 GitHub User Management

If you use GitHub to manage your source code, you can now [choose GitHub as your authentication provider for Nx Private Cloud](https://nx.app/docs/private-cloud-github-auth). Authentication is something you want to just work, so we’ve tried to make this as easy as possible to set up.

First you need to [create a new OAuth App in GitHub](https://github.com/settings/developers) for Nx Private Cloud.

![](/blog/images/2021-10-18/1*XUINIAdwB8Rofq4os2BoBQ.avif)

From this app you only need the client id and the client secret to get everything working. When you create the container from our Nx Cloud Docker image if you provide `GITHUB_AUTH_CLIENT_ID` and `GITHUB_AUTH_CLIENT_SECRET` as environment variables everything should work as expected, e.g.

```
\> docker create — name cloud \\
  -p 443:8081 \\
  -e CERT\_KEY=”$(cat ./tools/certs/key.pem)” \\
  -e CERT=”$(cat ./tools/certs/cert.pem)” \\
  -e NX\_CLOUD\_APP\_URL=”[https://cloud.myorg.com](https://cloud.myorg.com)” \\
  -e GITHUB\_AUTH\_CLIENT\_ID=”your\_github\_client\_id” \\
  -e GITHUB\_AUTH\_CLIENT\_SECRET=”your\_github\_client\_secret”
  -v /data/private-cloud:/data nxprivatecloud/nxcloud:latest
```

Once your container is up and running you will be able to invite team members using their GitHub usernames! It gets slightly more complicated if you’re running an on-premises GitHub Enterprise instance, but only by one more environment variable — you need to tell Nx Private Cloud where your GitHub instance lives by providing `GITHUB_API_URL` as well.

Once the OAuth App and Docker container are set up, navigating to your Nx Private Cloud instance will present you with a brand new way to login:

![](/blog/images/2021-10-18/1*bxE7LlRcLmQT0PhtabDW8Q.avif)

[Full details on how to integrate GitHub authentication are here](https://nx.app/docs/private-cloud-github-auth).

## 🏊‍♀️ Dive In

Getting started with Nx Cloud is as quick as connecting your existing Nx 12.x workspace to Nx Cloud.

```shell
npx nx connect-to-nx-cloud
```

For Nx workspaces prior to version 12:

Installing with `yarn`

```shell
yarn add [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud) && yarn nx g [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud):init
```

Installing with `npm`

```shell
npm install [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud) && npx nx g [@nrwl/nx-cloud](http://twitter.com/nrwl/nx-cloud):init
```

Once everything is installed, click the link in the console output to connect your workspace to Nx Cloud.

This gives you a fully hosted/managed Nx Cloud organization to use. View your run details, cache stats, and other information without additional infrastructure.

For full control over your cached data our Enterprise offering [Nx Private Cloud](https://nx.app/docs/get-started-with-private-cloud-enterprise) can be deployed internally within your organization with the same assurances and security of the hosted/managed Nx Cloud provided by Nrwl.

Visit [nx.app](https://nx.app) to learn more about Nx Cloud and how it can enhance your usage of Nx.
